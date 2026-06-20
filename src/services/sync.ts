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
import { db, type LocalActionPlan } from '../db';
import { fetchEquipments, createEquipmentRemote, updateEquipmentRemote, findEquipmentById, softDeleteEquipment, applyEquipmentInspectionStatusRemote, type ServiceResult } from './equipmentService';
import { fetchInspections, upsertInspection } from './inspectionService';
import { upsertActionPlan, deleteActionPlan } from './actionPlanService';
import {
  dbToEquipment,
  dbToInspection,
  dbToActionPlan,
  equipmentToDb,
  inspectionToDb,
  actionPlanToDb,
} from './mappers';
import type { ActionPlan, Equipment } from '../types';

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

  /** IDs of action plans that were successfully pushed. */
  pushedActionPlanIds: string[];
  /** IDs of action plans that were successfully deleted from cloud. */
  deletedActionPlanIds: string[];
}

function skip(reason: string): SyncReport {
  return {
    pushed: 0, pulled: 0, deleted: 0, errors: 0, skipped: true, reason,
    pushEqOk: 0, pushInsOk: 0, pushErrors: 0,
    pullEqImported: 0, pullEqReconciled: 0,
    pullInsImported: 0, pullInsReconciled: 0,
    pullEqError: false, pullInsError: false,
    pullEqEmpty: false, pullInsEmpty: false,
    pushedActionPlanIds: [], deletedActionPlanIds: [],
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

async function pushActionPlans(
  plans: LocalActionPlan[],
  userId?: string,
): Promise<{ ok: number; errors: number; deleted: number; syncedIds: string[]; deletedIds: string[] }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;
  const syncedIds: string[] = [];
  const deletedIds: string[] = [];

  // 1) pending deletes
  const toDelete = plans.filter((p) => p.pendingDelete);
  for (const plan of toDelete) {
    const success = await deleteActionPlan(plan.id);
    if (success) {
      deleted++;
      deletedIds.push(plan.id);
      console.log('[sync] Plano de ação %s deletado do Supabase', plan.id);
    } else {
      console.error('[sync] Falha ao deletar plano de ação %s no Supabase', plan.id);
      errors++;
    }
  }

  // 2) pending upserts — only push plans that have explicit sincronizado: false
  const pending = plans.filter((p) => p.sincronizado === false && !p.pendingDelete);
  for (const plan of pending) {
    const clean: ActionPlan = {
      id: plan.id,
      equipmentId: plan.equipmentId,
      local: plan.local,
      descricao: plan.descricao,
      criticidade: plan.criticidade,
      responsavel: plan.responsavel,
      prazo: plan.prazo,
      status: plan.status,
      createdAt: plan.createdAt,
      userId: plan.userId ?? userId,
    };
    const success = await upsertActionPlan(clean);
    if (success) {
      ok++;
      syncedIds.push(plan.id);
      console.log('[sync] Plano de ação %s sincronizado com sucesso', plan.id);
    } else {
      console.error('[sync] Falha ao sincronizar plano de ação %s — mantendo sincronizado: false', plan.id);
      errors++;
    }
  }
  return { ok, errors, deleted, syncedIds, deletedIds };
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
      const local = await db.equipamentos.get(eq.id);

      if (!local) {
        // Não inserir tombstones de equipamentos que este cliente nunca viu
        if (eq.deletedAt) continue;
        await db.equipamentos.put({ ...eq, sincronizado: true });
        imported++;
        continue;
      }

      // Preservar alterações locais pendentes
      if (!local.sincronizado || local.pendingDelete || local.syncAction || local.statusUpdatePending || local.syncError) {
        continue;
      }

      // Cloud tem tombstone → marcar local como deletado
      if (eq.deletedAt) {
        await db.equipamentos.put({
          ...eq,
          sincronizado: true,
          pendingDelete: false,
        });
        imported++;
        if (import.meta.env.DEV) console.log('[sync] Equipamento %s marcado como deletado (tombstone remota)', eq.id);
        continue;
      }

      // Linha local totalmente sincronizada → sobrescrever com dados do cloud
      await db.equipamentos.put({ ...eq, sincronizado: true });
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
    console.log('[sync] pullEquipments final: imported=%d reconciled=%d error=false empty=%s',
      imported, reconciled, cloud.length === 0 ? 'true' : 'false');
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
  localActionPlans: LocalActionPlan[] = [],
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
  if (import.meta.env.DEV) console.log('[sync] Iniciando sincronização...');

  let pushEqOk = 0;
  let pushInsOk = 0;
  let pushErrors = 0;
  let pulled = 0;
  let deleted = 0;
  let errors = 0;

  let pullEqImported = 0;
  let pullEqReconciled = 0;
  let pullEqError = false;
  let pullEqEmpty = false;

  let pullInsImported = 0;
  let pullInsReconciled = 0;
  let pullInsError = false;
  let pullInsEmpty = false;

  let pushedActionPlanIds: string[] = [];
  let deletedActionPlanIds: string[] = [];

  try {
    if (!options.pullOnly) {
      const eqR = await pushEquipments(options.userId);
      const insR = await pushInspections(options.userId);
      const apR = await pushActionPlans(localActionPlans, options.userId);
      pushEqOk = eqR.ok;
      pushInsOk = insR.ok;
      pushErrors = eqR.errors + insR.errors + apR.errors;
      deleted += eqR.deleted + insR.deleted + apR.deleted;
      errors += pushErrors;
      pushedActionPlanIds = apR.syncedIds;
      deletedActionPlanIds = apR.deletedIds;
    }

    if (!options.pushOnly) {
      const eqP = await pullEquipments();
      const insP = await pullInspections();

      pullEqImported = eqP.imported;
      pullEqReconciled = eqP.reconciled;
      pullEqError = eqP.error;
      pullEqEmpty = eqP.empty;

      pullInsImported = insP.imported;
      pullInsReconciled = insP.reconciled;
      pullInsError = insP.error;
      pullInsEmpty = insP.empty;

      pulled += eqP.imported + insP.imported;
      if (eqP.error || insP.error) errors++;
    }
  } catch (err) {
    console.error('[sync] exceção durante syncAll:', err);
    errors++;
  } finally {
    if (import.meta.env.DEV) {
      console.log('[sync] Sincronização concluída. ' +
        `Push eq=${pushEqOk} ins=${pushInsOk} errors=${pushErrors} | ` +
        `Pull eq=${pullEqImported}(${pullEqReconciled} orfãos) ins=${pullInsImported}(${pullInsReconciled} orfãos) | ` +
        `Delete=${deleted} Erros=${errors}`);
    }
    _syncInProgress = false;
  }

  return {
    pushed: pushEqOk + pushInsOk,
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
    pushedActionPlanIds,
    deletedActionPlanIds,
  };
}

/** Counts the rows that still need to be pushed — surfaced in the UI. */
export async function pendingSyncCount(): Promise<number> {
  const eqs = await db.equipamentos.filter((e) => !e.sincronizado || !!e.pendingDelete).count();
  const ins = await db.inspecoes.filter((i) => !i.sincronizado || !!i.pendingDelete).count();
  // Action plans are not in Dexie; callers should also count those from the
  // store if they care.
  return eqs + ins;
}

// Re-export the mapper helpers for convenience.
export { dbToEquipment, dbToInspection, dbToActionPlan, equipmentToDb, inspectionToDb, actionPlanToDb };
