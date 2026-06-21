/**
 * Sync orchestrator.
 *
 * Bidirectional sync between Dexie (local cache) and Supabase (cloud).
 *
 *   • `pushPending()` — finds rows with `sincronizado === false` and
 *     upserts them. Marks `sincronizado = true` on success. For rows
 *     flagged `pendingDelete`, performs a DELETE and removes them locally.
 *
 *   • `pullFromCloud()` — fetches the full tables and replaces the local
 *     rows that weren't just-modified (i.e. are already synced). Local
 *     pending changes are always preserved.
 *
 *   • `syncAll()` — convenience wrapper that calls push, then pull.
 *
 * The orchestrator is intentionally fire-and-forget: callers can `await`
 * it for tests / UI feedback, but errors never throw — they are logged
 * and the sync state remains valid (rows stay `sincronizado: false`).
 *
 * Concurrency: a module-level `_syncInProgress` flag prevents overlapping
 * sync runs. Callers that attempt a concurrent sync will get a skipped
 * report.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db } from '../db';
import { fetchEquipments, createEquipmentRemote, updateEquipmentRemote, findEquipmentById, softDeleteEquipment, applyEquipmentInspectionStatusRemote, type ServiceResult } from './equipmentService';
import { fetchInspections, upsertInspection } from './inspectionService';
import {
  fetchActionPlans,
  createActionPlanRemote,
  updateActionPlanRemote,
  softDeleteActionPlanRemote,
} from './actionPlanService';
import {
  dbToEquipment,
  dbToInspection,
  equipmentToDb,
  inspectionToDb,
} from './mappers';
import type { Equipment } from '../types';
import { syncEquipmentQrFields } from '../utils/equipmentIdentity';

/** Concurrency guard — prevents overlapping sync runs. */
let _syncInProgress = false;

export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  errors: number;
  skipped: boolean;
  reason?: string;

  // -- Detalhamento por domínio --
  pushEqOk: number;
  pushInsOk: number;
  pushErrors: number;
  pullEqImported: number;
  pullEqReconciled: number;
  pullInsImported: number;
  pullInsReconciled: number;
  pullEqError: boolean;
  pullInsError: boolean;
  pullEqEmpty: boolean;
  pullInsEmpty: boolean;

  // -- Detalhamento de planos de ação --
  pushApOk: number;
  pushApErrors: number;
  pullApImported: number;
  pullApReconciled: number;
  pullApError: boolean;
  pullApEmpty: boolean;
}

function skip(reason: string): SyncReport {
  return {
    pushed: 0, pulled: 0, deleted: 0, errors: 0, skipped: true, reason,
    pushEqOk: 0, pushInsOk: 0, pushErrors: 0,
    pullEqImported: 0, pullEqReconciled: 0,
    pullInsImported: 0, pullInsReconciled: 0,
    pullEqError: false, pullInsError: false,
    pullEqEmpty: false, pullInsEmpty: false,
    pushApOk: 0, pushApErrors: 0,
    pullApImported: 0, pullApReconciled: 0,
    pullApError: false, pullApEmpty: false,
  };
}

function canSync(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!isSupabaseConfigured || !supabase) return false;
  return true;
}

export function isSyncInProgress(): boolean {
  return _syncInProgress;
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------

async function pushEquipments(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  // 1) pending deletes — soft delete
  const toDelete = await db.equipamentos.filter((e) => !!e.pendingDelete).toArray();
  if (import.meta.env.DEV && toDelete.length > 0) {
    console.log(`[sync] pushEquipments: ${toDelete.length} exclusões pendentes (${toDelete.map(e => e.id).join(', ')})`);
  }
  for (const eq of toDelete) {
    const success = await softDeleteEquipment(eq.id, userId);
    if (success) {
      await db.equipamentos.update(eq.id, {
        pendingDelete: false,
        sincronizado: true,
        syncAction: undefined,
        deletedAt: new Date().toISOString(),
        deletedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      });
      deleted++;
      console.log('[sync] Equipamento %s deletado (soft) do Supabase', eq.id);
    } else {
      console.error('[sync.pushEquipments] Falha ao deletar equipamento no Supabase', {
        id: eq.id,
      });
      errors++;
    }
  }

  // 2) pending sync — create / update (exclui syncError e itens com statusUpdatePending
  //    sem syncAction — são sincronizados via RPC em pushInspections)
  const pending = await db.equipamentos
    .filter((e) => !e.sincronizado && !e.pendingDelete && !e.syncError && !(e.statusUpdatePending && !e.syncAction))
    .toArray();
  if (import.meta.env.DEV && pending.length > 0) {
    console.log(`[sync] pushEquipments: ${pending.length} pendentes (${pending.map(e => e.id).join(', ')})`);
  }
  for (const eq of pending) {
    let toSync: Equipment = eq;
    if (!eq.createdBy && userId) {
      await db.equipamentos.update(eq.id, { createdBy: userId });
      toSync = { ...eq, createdBy: userId };
    }

    let result: ServiceResult;

    if (eq.syncAction === 'create') {
      result = await createEquipmentRemote(toSync);
    } else if (eq.syncAction === 'update') {
      result = await updateEquipmentRemote(toSync);
    } else {
      // Legacy — sem syncAction: tenta detectar se é create ou update
      const remote = await findEquipmentById(eq.id);
      if (remote) {
        result = await updateEquipmentRemote(toSync);
      } else {
        result = await createEquipmentRemote(toSync);
      }
    }

    if (result.ok) {
      await db.equipamentos.update(eq.id, {
        sincronizado: true,
        syncAction: undefined,
        syncError: undefined,
      });
      ok++;
      console.log('[sync] Equipamento %s sincronizado com sucesso', eq.id);
    } else {
      if (result.code === 'duplicate') {
        // Conflito — marca syncError e mantém dados intactos (sem rollback)
        await db.equipamentos.update(eq.id, {
          syncError: 'duplicate',
        });
        console.warn(
          '[sync] Conflito de duplicidade para %s — syncError=duplicate. ' +
          'O usuário precisa alterar a TAG para sincronizar.', eq.id,
        );
        // Não incrementa errors — conflito não é erro transitório
      } else {
        console.error('[sync] Falha ao sincronizar equipamento %s — mantendo sincronizado: false', eq.id);
        errors++;
      }
    }
  }
  if (import.meta.env.DEV) {
    console.log(`[sync] pushEquipments final: ok=${ok} errors=${errors} deleted=${deleted}`);
  }
  return { ok, errors, deleted };
}

async function pushInspections(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  const toDelete = await db.inspecoes.filter((i) => !!i.pendingDelete).toArray();
  for (const insp of toDelete) {
    // Cloud already stores a `sincronizado` flag — use it as a tombstone.
    // (We keep the row locally until the cloud DELETE succeeds, then purge.)
    if (supabase) {
      const { error } = await supabase.from('inspecoes').delete().eq('id', insp.id);
      if (!error) {
        await db.inspecoes.delete(insp.id);
        deleted++;
      } else {
        console.error('[sync.pushInspections] Falha ao deletar inspeção no Supabase', {
          id: insp.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        errors++;
      }
    }
  }

  const pending = await db.inspecoes.filter((i) => !i.sincronizado && !i.pendingDelete).toArray();
  for (const insp of pending) {
    let toUpsert = insp;
    if (!insp.userId && userId) {
      await db.inspecoes.update(insp.id, { userId });
      toUpsert = { ...insp, userId };
    }

    // 1. Enviar inspeção para o Supabase
    const success = await upsertInspection(toUpsert);
    if (!success) {
      console.error('[sync] Falha ao sincronizar inspeção %s — mantendo sincronizado: false', insp.id);
      errors++;
      continue;
    }

    // 2. Aplicar status do equipamento via RPC segura (SECURITY DEFINER)
    const localEq = await db.equipamentos.get(insp.equipmentId);
    const rpcResult = await applyEquipmentInspectionStatusRemote(
      insp.equipmentId,
      insp.status,
      insp.data,
      localEq?.dataProximaInspecao ?? undefined,
    );

    if (rpcResult.ok) {
      // 3. Sucesso completo: marcar inspeção como sincronizada e atualizar equipamento local
      await db.inspecoes.update(insp.id, { sincronizado: true });

      // Atualizar equipamento local com os dados retornados pela RPC
      if (rpcResult.data) {
        const rpcData = rpcResult.data as unknown as Record<string, unknown>;
        await db.equipamentos.update(insp.equipmentId, {
          sincronizado: true,
          statusUpdatePending: undefined,
          updatedAt: (typeof rpcData.updated_at === 'string' ? rpcData.updated_at : undefined) as string | undefined,
          status: typeof rpcData.status === 'string' ? (rpcData.status as Equipment['status']) : undefined,
          dataUltimaInspecao: typeof rpcData.data_ultima_inspecao === 'string' ? rpcData.data_ultima_inspecao : undefined,
          dataProximaInspecao: typeof rpcData.data_proxima_inspecao === 'string' ? rpcData.data_proxima_inspecao : undefined,
        });
      } else {
        // RPC retornou ok sem data — apenas limpar flags
        await db.equipamentos.update(insp.equipmentId, {
          sincronizado: true,
          statusUpdatePending: undefined,
        });
      }

      ok++;
      console.log('[sync] Inspeção %s e status do equipamento %s sincronizados com sucesso',
        insp.id, insp.equipmentId);
    } else {
      // RPC falhou — NÃO marcar inspeção como sincronizada para retentar
      console.error('[sync] Inspeção %s enviada, mas RPC de status falhou: %s',
        insp.id, rpcResult.message ?? rpcResult.code);
      errors++;
    }
  }
  return { ok, errors, deleted };
}

async function pushActionPlans(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  // 1) pending deletes — soft delete
  const toDelete = await db.planosAcao.filter((p) => !!p.pendingDelete).toArray();
  for (const plan of toDelete) {
    const result = await softDeleteActionPlanRemote(plan.id, userId);
    if (result.ok) {
      await db.planosAcao.update(plan.id, {
        pendingDelete: false,
        sincronizado: true,
        syncAction: undefined,
        deletedAt: new Date().toISOString(),
        deletedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      });
      deleted++;
      console.log('[sync] Plano %s deletado (soft) do Supabase', plan.id);
    } else {
      console.error('[sync.pushActionPlans] Falha ao deletar plano no Supabase', { id: plan.id });
      errors++;
    }
  }

  // 2) pending sync — create / update
  const pending = await db.planosAcao
    .filter((p) => !p.sincronizado && !p.pendingDelete && !p.syncError)
    .toArray();
  if (import.meta.env.DEV && pending.length > 0) {
    console.log(`[sync] pushActionPlans: ${pending.length} pendentes (${pending.map(p => p.id).join(', ')})`);
  }
  for (const plan of pending) {
    const toSync = { ...plan, userId: plan.userId ?? userId };

    let result: ServiceResult;

    if (plan.syncAction === 'create') {
      result = await createActionPlanRemote(toSync);
    } else if (plan.syncAction === 'update') {
      result = await updateActionPlanRemote(toSync);
    } else {
      // Legacy — sem syncAction: tenta create; se duplicar, faz update
      result = await createActionPlanRemote(toSync);
      if (!result.ok && result.code === 'duplicate') {
        result = await updateActionPlanRemote(toSync);
      }
    }

    if (result.ok) {
      await db.planosAcao.update(plan.id, {
        sincronizado: true,
        syncAction: undefined,
        syncError: undefined,
      });
      ok++;
      console.log('[sync] Plano %s sincronizado com sucesso', plan.id);
    } else {
      if (result.code === 'duplicate') {
        await db.planosAcao.update(plan.id, {
          syncError: 'duplicate',
        });
        console.warn('[sync] Conflito de duplicidade para plano %s — syncError=duplicate', plan.id);
      } else {
        console.error('[sync] Falha ao sincronizar plano %s — mantendo sincronizado: false', plan.id);
        errors++;
      }
    }
  }
  if (import.meta.env.DEV) {
    console.log(`[sync] pushActionPlans final: ok=${ok} errors=${errors} deleted=${deleted}`);
  }
  return { ok, errors, deleted };
}

// ---------------------------------------------------------------------------
// PULL
// ---------------------------------------------------------------------------

interface PullResult {
  imported: number;
  reconciled: number;
  error: boolean;
  /** true quando o Supabase retornou resposta válida vazia (não erro). */
  empty: boolean;
}

/** Import cloud equipment rows, reconcile orphans, preserve pending changes.
 *  Regras:
 *   • Se fetch falhar (rede/RLS/Supabase) → preserva tudo, não reconcilia.
 *   • Se fetch retornar lista vazia → reconcilia órfãos (pode ser a exclusão
 *     do último item no servidor).
 *   • Itens locais sincronizados sem pendência que não existem no cloud
 *     são marcados com deletedAt (soft delete local).
 *   • Itens locais pendentes (sincronizado: false, pendingDelete, syncAction,
 *     statusUpdatePending, syncError) são sempre preservados. */
async function pullEquipments(): Promise<PullResult> {
  if (import.meta.env.DEV) console.log('[sync] pullEquipments...');
  const result = await fetchEquipments();

  // --- Erro remoto: preservar tudo ---
  if (!result.ok) {
    console.error('[sync] pullEquipments erro: preservando dados locais');
    return { imported: 0, reconciled: 0, error: true, empty: false };
  }

  const cloud = result.data ?? [];
  const cloudIds = new Set(cloud.map((e) => e.id));
  let imported = 0;
  let reconciled = 0;
  const reconciledIds: string[] = [];

  await db.transaction('rw', db.equipamentos, async () => {
    // --- Importar / atualizar registros do cloud ---
    for (const eq of cloud) {
      const normalEq = syncEquipmentQrFields(eq);
      const local = await db.equipamentos.get(normalEq.id);

      if (!local) {
        // Não inserir tombstones de equipamentos que este cliente nunca viu
        if (normalEq.deletedAt) continue;
        await db.equipamentos.put({ ...normalEq, sincronizado: true });
        imported++;
        continue;
      }

      // Preservar alterações locais pendentes
      if (!local.sincronizado || local.pendingDelete || local.syncAction || local.statusUpdatePending || local.syncError) {
        continue;
      }

      // Cloud tem tombstone → marcar local como deletado
      if (normalEq.deletedAt) {
        await db.equipamentos.put({
          ...normalEq,
          sincronizado: true,
          pendingDelete: false,
        });
        imported++;
        if (import.meta.env.DEV) console.log('[sync] Equipamento %s marcado como deletado (tombstone remota)', normalEq.id);
        continue;
      }

      // Linha local totalmente sincronizada → sobrescrever com dados do cloud
      await db.equipamentos.put({ ...normalEq, sincronizado: true });
      imported++;
    }

    // --- Reconciliação de órfãos locais ---
    // Registros que existem no IndexedDB mas não no cloud (hard-delete remoto
    // ou pull vazio válido). Marcamos com deletedAt para ocultar da UI.
    //
    // Preservamos itens com:
    //   sincronizado === false    → alteração local não enviada
    //   pendingDelete === true    → exclusão local pendente
    //   syncAction                → operação local pendente (create/update/delete)
    //   statusUpdatePending       → status local aguardando RPC
    //   syncError                 → conflito conhecido
    //   deletedAt preenchido      → já reconciliado
    // ---
    const now = new Date().toISOString();
    const allLocal = await db.equipamentos.toArray();

    for (const local of allLocal) {
      if (cloudIds.has(local.id)) continue;
      if (!local.sincronizado) continue;
      if (local.pendingDelete) continue;
      if (local.syncAction) continue;
      if (local.statusUpdatePending) continue;
      if (local.syncError) continue;
      if (local.deletedAt) continue;

      await db.equipamentos.update(local.id, {
        deletedAt: now,
        deletedBy: null,
        updatedAt: now,
        sincronizado: true,
        pendingDelete: false,
      });
      reconciled++;
      reconciledIds.push(local.id);
      if (import.meta.env.DEV) {
        console.log('[sync] equipment orphan marked deletedAt: %s', local.id);
      }
    }

    if (import.meta.env.DEV && reconciled > 0) {
      console.log('[sync] Pull equipamentos: %d cloud, %d importados, %d órfãos reconciliados',
        cloud.length, imported, reconciled);
    }
  });

  if (import.meta.env.DEV) {
    console.log('[sync] pullEquipments final: cloud=%d imported=%d reconciled=%d empty=%s',
      cloud.length, imported, reconciled, cloud.length === 0 ? 'true' : 'false');
  }
  return { imported, reconciled, error: false, empty: cloud.length === 0 };
}

async function pullInspections(): Promise<PullResult> {
  if (import.meta.env.DEV) console.log('[sync] pullInspections...');
  const result = await fetchInspections();

  // --- Erro remoto: preservar tudo ---
  if (!result.ok) {
    console.error('[sync] pullInspections erro: preservando dados locais');
    return { imported: 0, reconciled: 0, error: true, empty: false };
  }

  const cloud = result.data ?? [];
  const cloudIds = new Set(cloud.map((i) => i.id));
  let imported = 0;
  let reconciled = 0;

  await db.transaction('rw', db.inspecoes, async () => {
    // --- Importar / atualizar registros do cloud ---
    for (const insp of cloud) {
      const local = await db.inspecoes.get(insp.id);
      if (!local) {
        await db.inspecoes.put({ ...insp, sincronizado: true });
        imported++;
      } else if (local.sincronizado && !local.pendingDelete) {
        await db.inspecoes.put({ ...insp, sincronizado: true });
        imported++;
      }
      // else: local has unsynced changes — preserve them.
    }

    // --- Reconciliação de órfãos locais ---
    const allLocal = await db.inspecoes.toArray();
    for (const local of allLocal) {
      if (cloudIds.has(local.id)) continue;
      if (!local.sincronizado) continue;
      if (local.pendingDelete) continue;

      // Inspeção sincronizada sem pendência que não existe no cloud → remover
      await db.inspecoes.delete(local.id);
      reconciled++;
      if (import.meta.env.DEV) {
        console.log('[sync] inspection orphan removed: %s', local.id);
      }
    }

    if (import.meta.env.DEV && reconciled > 0) {
      console.log('[sync] Pull inspeções: %d cloud, %d importadas, %d órfãos removidos',
        cloud.length, imported, reconciled);
    }
  });

  if (import.meta.env.DEV) {
    console.log('[sync] pullInspections final: imported=%d reconciled=%d error=false empty=%s',
      imported, reconciled, cloud.length === 0 ? 'true' : 'false');
  }
  return { imported, reconciled, error: false, empty: cloud.length === 0 };
}

async function pullActionPlans(): Promise<PullResult> {
  if (import.meta.env.DEV) console.log('[sync] pullActionPlans...');
  const result = await fetchActionPlans();

  if (!result.ok) {
    console.error('[sync] pullActionPlans erro: preservando dados locais');
    return { imported: 0, reconciled: 0, error: true, empty: false };
  }

  const cloud = result.data ?? [];
  const cloudIds = new Set(cloud.map((p) => p.id));
  let imported = 0;
  let reconciled = 0;

  await db.transaction('rw', db.planosAcao, async () => {
    for (const plan of cloud) {
      const local = await db.planosAcao.get(plan.id);

      if (!local) {
        // Não inserir tombstones que este cliente nunca viu
        if (plan.deletedAt) continue;
        await db.planosAcao.put({ ...plan, sincronizado: true });
        imported++;
        continue;
      }

      // Preservar alterações locais pendentes
      if (!local.sincronizado || local.pendingDelete || local.syncAction || local.syncError) {
        continue;
      }

      // Cloud tem tombstone → marcar local como deletado
      if (plan.deletedAt) {
        await db.planosAcao.put({
          ...plan,
          sincronizado: true,
          pendingDelete: false,
        });
        imported++;
        if (import.meta.env.DEV) console.log('[sync] Plano %s marcado como deletado (tombstone remota)', plan.id);
        continue;
      }

      // Linha local totalmente sincronizada → sobrescrever com dados do cloud
      await db.planosAcao.put({ ...plan, sincronizado: true });
      imported++;
    }

    // --- Reconciliação de órfãos locais ---
    const now = new Date().toISOString();
    const allLocal = await db.planosAcao.toArray();

    for (const local of allLocal) {
      if (cloudIds.has(local.id)) continue;
      if (!local.sincronizado) continue;
      if (local.pendingDelete) continue;
      if (local.syncAction) continue;
      if (local.syncError) continue;
      if (local.deletedAt) continue;

      await db.planosAcao.update(local.id, {
        deletedAt: now,
        deletedBy: null,
        updatedAt: now,
        sincronizado: true,
        pendingDelete: false,
      });
      reconciled++;
      if (import.meta.env.DEV) {
        console.log('[sync] plan orphan marked deletedAt: %s', local.id);
      }
    }
  });

  if (import.meta.env.DEV) {
    console.log('[sync] pullActionPlans final: cloud=%d imported=%d reconciled=%d empty=%s',
      cloud.length, imported, reconciled, cloud.length === 0 ? 'true' : 'false');
  }
  return { imported, reconciled, error: false, empty: cloud.length === 0 };
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Skip the cloud→local pull phase (push only). */
  pushOnly?: boolean;
  /** Skip the local→cloud push phase (pull only). */
  pullOnly?: boolean;
  /** Current user ID to stamp ownership on records that lack it. */
  userId?: string;
}

export async function syncAll(
  options: SyncOptions = {},
): Promise<SyncReport> {
  if (_syncInProgress) {
    console.log('[sync] sync já em andamento — ignorando chamada concorrente');
    return skip('sync-in-progress');
  }

  if (!canSync()) {
    return skip(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'offline'
        : 'supabase-not-configured',
    );
  }

  _syncInProgress = true;
  if (import.meta.env.DEV) {
    console.log('[sync] ===== INÍCIO =====');
    console.log('[sync] Iniciando sincronização...');
    const userId = options.userId;
    if (userId) console.log(`[sync] userId=${userId}`);
  }

  let pushEqOk = 0;
  let pushInsOk = 0;
  let pushErrors = 0;
  let pulled = 0;
  let deleted = 0;
  let errors = 0;

  let pushApOk = 0;
  let pushApErrors = 0;

  let pullEqImported = 0;
  let pullEqReconciled = 0;
  let pullEqError = false;
  let pullEqEmpty = false;

  let pullInsImported = 0;
  let pullInsReconciled = 0;
  let pullInsError = false;
  let pullInsEmpty = false;

  let pullApImported = 0;
  let pullApReconciled = 0;
  let pullApError = false;
  let pullApEmpty = false;

  try {
    if (!options.pullOnly) {
      const eqR = await pushEquipments(options.userId);
      const insR = await pushInspections(options.userId);
      const apR = await pushActionPlans(options.userId);
      pushEqOk = eqR.ok;
      pushInsOk = insR.ok;
      pushApOk = apR.ok;
      pushApErrors = apR.errors;
      pushErrors = eqR.errors + insR.errors + apR.errors;
      deleted += eqR.deleted + insR.deleted + apR.deleted;
      errors += pushErrors;
    }

    if (!options.pushOnly) {
      const eqP = await pullEquipments();
      const insP = await pullInspections();
      const apP = await pullActionPlans();

      pullEqImported = eqP.imported;
      pullEqReconciled = eqP.reconciled;
      pullEqError = eqP.error;
      pullEqEmpty = eqP.empty;

      pullInsImported = insP.imported;
      pullInsReconciled = insP.reconciled;
      pullInsError = insP.error;
      pullInsEmpty = insP.empty;

      pullApImported = apP.imported;
      pullApReconciled = apP.reconciled;
      pullApError = apP.error;
      pullApEmpty = apP.empty;

      pulled += eqP.imported + insP.imported + apP.imported;
      if (eqP.error || insP.error || apP.error) errors++;
    }
  } catch (err) {
    console.error('[sync] exceção durante syncAll:', err);
    errors++;
  } finally {
    if (import.meta.env.DEV) {
      console.log('[sync] ===== RESUMO =====');
      console.log('[sync] ' +
        `Push: eq=${pushEqOk} ins=${pushInsOk} ap=${pushApOk} errors=${pushErrors} | ` +
        `Pull: eq=${pullEqImported}(${pullEqReconciled}) ins=${pullInsImported}(${pullInsReconciled}) ap=${pullApImported}(${pullApReconciled}) | ` +
        `Delete=${deleted} Erros=${errors}`);
    }
    _syncInProgress = false;
    if (import.meta.env.DEV) console.log('[sync] ===== FIM =====');
  }

  return {
    pushed: pushEqOk + pushInsOk + pushApOk,
    pulled,
    deleted,
    errors,
    skipped: false,
    pushEqOk,
    pushInsOk,
    pushErrors,
    pullEqImported,
    pullEqReconciled,
    pullInsImported,
    pullInsReconciled,
    pullEqError,
    pullInsError,
    pullEqEmpty,
    pullInsEmpty,
    pushApOk,
    pushApErrors,
    pullApImported,
    pullApReconciled,
    pullApError,
    pullApEmpty,
  };
}

/** Counts the rows that still need to be pushed — surfaced in the UI. */
export async function pendingSyncCount(): Promise<number> {
  const eqs = await db.equipamentos.filter((e) => !e.sincronizado || !!e.pendingDelete).count();
  const ins = await db.inspecoes.filter((i) => !i.sincronizado || !!i.pendingDelete).count();
  const aps = await db.planosAcao.filter((p) => !p.sincronizado || !!p.pendingDelete).count();
  return eqs + ins + aps;
}

// Re-export the mapper helpers for convenience.
export { dbToEquipment, dbToInspection, equipmentToDb, inspectionToDb };
