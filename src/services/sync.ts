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
import { db, type LocalInspection, type LocalEquipment, type LocalInspectionPhoto } from '../db';
import {
  fetchEquipments, createEquipmentRemote, updateEquipmentRemote, fetchEquipmentById, softDeleteEquipment, type ServiceResult,
} from './equipmentService';
import { fetchInspections, upsertInspection, fetchInspectionById, updateInspectionRemote, recalculateEquipmentFromLatestInspectionRemote } from './inspectionService';
import {
  fetchActionPlans,
  fetchActionPlanById,
  createActionPlanRemote,
  updateActionPlanRemote,
  softDeleteActionPlanRemote,
} from './actionPlanService';
import {
  dbToEquipment,
  dbToInspection,
  equipmentToDb,
  inspectionToDb,
  type DbFotoInspecao,
} from './mappers';
import { getInspectionPhotoBlob, mimeToExtension, uploadInspectionPhotoBlob, removeInspectionPhotoObject } from './photoService';
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

  // -- Detalhamento de fotos de inspeção --
  pushPhotoOk: number;
  pushPhotoErrors: number;
  /** Fotos adiadas porque a inspeção pai ainda não existe remotamente. */
  pushPhotoSkipped: number;
  pullPhotoImported: number;
  pullPhotoReconciled: number;
  pullPhotoError: boolean;
  pullPhotoEmpty: boolean;
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
    pushPhotoOk: 0, pushPhotoErrors: 0, pushPhotoSkipped: 0,
    pullPhotoImported: 0, pullPhotoReconciled: 0,
    pullPhotoError: false, pullPhotoEmpty: false,
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

/** Compare two ISO date strings by their numeric timestamp.
 *  Returns true when the remote timestamp differs from the local base. */
function isConflict(localBase: string | null | undefined, remoteUpdatedAt: string | undefined): boolean {
  if (!localBase || !remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() !== new Date(localBase).getTime();
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------

async function pushEquipments(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  const markConflict = async (id: string, remoteUpdatedAt: string, reason: string) => {
    if (import.meta.env.DEV) {
      console.log(`[conflict] detected for equipment ${id}: ${reason}`);
    }
    await db.equipamentos.update(id, {
      syncConflict: true,
      syncConflictReason: reason,
      remoteUpdatedAtAtConflict: remoteUpdatedAt,
      syncError: 'conflict',
      sincronizado: false,
    });
  };

  // 1) pending deletes — soft delete com verificação de conflito
  const toDelete = await db.equipamentos.filter((e) => !!e.pendingDelete).toArray();
  if (import.meta.env.DEV && toDelete.length > 0) {
    console.log(`[sync] pushEquipments: ${toDelete.length} exclusões pendentes (${toDelete.map(e => e.id).join(', ')})`);
  }
  for (const eq of toDelete) {
    // Verificar conflito antes de deletar
    const remoteResult = await fetchEquipmentById(eq.id);
    if (remoteResult.ok && remoteResult.data) {
      const remote = remoteResult.data;
      if (remote.deletedAt) {
        // Já deletado remotamente — reconciliar
        await db.equipamentos.update(eq.id, {
          pendingDelete: false,
          sincronizado: true,
          syncAction: undefined,
          syncConflict: false,
          syncConflictReason: undefined,
          syncError: undefined,
          deletedAt: remote.deletedAt,
          deletedBy: remote.deletedBy ?? userId ?? null,
          updatedAt: remote.updatedAt ?? new Date().toISOString(),
        });
        deleted++;
        if (import.meta.env.DEV) console.log('[sync] Equipamento %s já deletado remotamente — reconciliado', eq.id);
        continue;
      }
      if (isConflict(eq.syncBaseUpdatedAt, remote.updatedAt)) {
        await markConflict(eq.id, remote.updatedAt ?? '', 'Este equipamento foi alterado em outro dispositivo antes da exclusão. Revise antes de excluir.');
        errors++;
        continue;
      }
    } else if (!remoteResult.ok && remoteResult.code !== 'not_found') {
      // Erro de rede — preservar pendência
      console.error('[sync.pushEquipments] Erro ao verificar conflito para exclusão', { id: eq.id });
      errors++;
      continue;
    }
    // Sem conflito ou não encontrado — prosseguir com soft delete
    const result = await softDeleteEquipment(eq.id, userId);
    const remoteRow = result.data as unknown as Record<string, unknown>;
    if (result.ok && remoteRow && remoteRow.deleted_at) {
      const remoteData = remoteRow;
      await db.equipamentos.update(eq.id, {
        pendingDelete: false,
        sincronizado: true,
        syncAction: undefined,
        syncConflict: false,
        syncConflictReason: undefined,
        syncError: undefined,
        deletedAt: (remoteData.deleted_at as string) ?? new Date().toISOString(),
        deletedBy: (remoteData.deleted_by as string | null) ?? userId ?? null,
        updatedAt: (remoteData.updated_at as string) ?? new Date().toISOString(),
      });
      deleted++;
      if (import.meta.env.DEV) console.log('[sync] Equipamento %s deletado (soft) do Supabase', eq.id);
    } else {
      await db.equipamentos.update(eq.id, { syncError: result.code ?? 'unknown' });
      console.error('[sync.pushEquipments] Falha ao deletar equipamento no Supabase', { id: eq.id, code: result.code, message: result.message });
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
      // Create não precisa verificar conflito — é inserção nova
      result = await createEquipmentRemote(toSync);
      if (result.ok) {
        // Buscar updated_at remoto após criação para salvar como base
        const fetchResult = await fetchEquipmentById(eq.id);
        const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
        await db.equipamentos.update(eq.id, {
          sincronizado: true,
          syncAction: undefined,
          syncError: undefined,
          syncConflict: false,
          syncConflictReason: undefined,
          syncBaseUpdatedAt: remoteUpdatedAt,
          updatedAt: remoteUpdatedAt,
        });
        ok++;
        if (import.meta.env.DEV) console.log('[sync] Equipamento %s criado com sucesso', eq.id);
      }
    } else if (eq.syncAction === 'update') {
      // Verificar conflito antes de atualizar
      if (import.meta.env.DEV) {
        console.log(`[conflict] checking equipment ${eq.id}: base=${eq.syncBaseUpdatedAt}`);
      }
      const remoteResult = await fetchEquipmentById(eq.id);
      if (!remoteResult.ok) {
        if (remoteResult.code === 'not_found') {
          // Remoto não existe — tratar como criação
          result = await createEquipmentRemote(toSync);
          if (result.ok) {
            const fetchResult = await fetchEquipmentById(eq.id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
            await db.equipamentos.update(eq.id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              syncBaseUpdatedAt: remoteUpdatedAt,
              updatedAt: remoteUpdatedAt,
            });
            ok++;
            if (import.meta.env.DEV) console.log('[sync] Equipamento %s recriado no servidor (não existia)', eq.id);
          }
        } else {
          // Erro de rede — preservar pendência
          console.error('[sync.pushEquipments] Erro ao verificar conflito para update', { id: eq.id });
          errors++;
          continue;
        }
      } else {
        const remote = remoteResult.data!;
        if (import.meta.env.DEV) {
          console.log(`[conflict] remote updated_at=${remote.updatedAt}, local base=${eq.syncBaseUpdatedAt}`);
        }
        if (isConflict(eq.syncBaseUpdatedAt, remote.updatedAt)) {
          await markConflict(eq.id, remote.updatedAt ?? '', 'Este registro foi alterado em outro dispositivo antes da sincronização. Revise antes de continuar.');
          if (import.meta.env.DEV) console.log(`[conflict] update blocked for equipment ${eq.id}`);
          // Não conta como erro — é conflito controlado
        } else {
          if (import.meta.env.DEV) console.log(`[conflict] update allowed for equipment ${eq.id}`);
          result = await updateEquipmentRemote(toSync);
          if (result.ok) {
            // Buscar updated_at remoto após update
            const fetchResult = await fetchEquipmentById(eq.id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
            await db.equipamentos.update(eq.id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              syncBaseUpdatedAt: remoteUpdatedAt,
              updatedAt: remoteUpdatedAt,
            });
            ok++;
            if (import.meta.env.DEV) console.log('[sync] Equipamento %s atualizado com sucesso', eq.id);
          } else {
            console.error('[sync] Falha ao atualizar equipamento %s — mantendo sincronizado: false', eq.id);
            errors++;
          }
        }
      }
    } else {
      // Legacy — sem syncAction: tenta detectar se é create ou update
      const remoteResult = await fetchEquipmentById(eq.id);
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        if (isConflict(eq.syncBaseUpdatedAt, remote.updatedAt)) {
          await markConflict(eq.id, remote.updatedAt ?? '', 'Conflito detectado em registro legado. Revise antes de continuar.');
          continue;
        }
        result = await updateEquipmentRemote(toSync);
        if (result.ok) {
          const fetchResult = await fetchEquipmentById(eq.id);
          const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
          await db.equipamentos.update(eq.id, {
            sincronizado: true,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            syncBaseUpdatedAt: remoteUpdatedAt,
            updatedAt: remoteUpdatedAt,
          });
          ok++;
        } else {
          console.error('[sync] Falha ao sincronizar equipamento %s — mantendo sincronizado: false', eq.id);
          errors++;
        }
      } else if (!remoteResult.ok && remoteResult.code !== 'not_found') {
        console.error('[sync] Erro ao verificar equipamento remoto %s', eq.id);
        errors++;
      } else {
        result = await createEquipmentRemote(toSync);
        if (result.ok) {
          const fetchResult = await fetchEquipmentById(eq.id);
          const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
          await db.equipamentos.update(eq.id, {
            sincronizado: true,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            syncBaseUpdatedAt: remoteUpdatedAt,
            updatedAt: remoteUpdatedAt,
          });
          ok++;
        } else if (result.code === 'duplicate') {
          await db.equipamentos.update(eq.id, { syncError: 'duplicate' });
          if (import.meta.env.DEV) console.warn('[sync] Conflito de duplicidade para %s — syncError=duplicate', eq.id);
        } else {
          console.error('[sync] Falha ao sincronizar equipamento %s', eq.id);
          errors++;
        }
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

  const markConflict = async (id: string, remoteUpdatedAt: string | null, reason: string) => {
    if (import.meta.env.DEV) {
      console.log(`[conflict] detected for inspection ${id}: ${reason}`);
    }
    await db.inspecoes.update(id, {
      syncConflict: true,
      syncConflictReason: reason,
      remoteUpdatedAtAtConflict: remoteUpdatedAt,
      syncError: 'conflict',
      sincronizado: false,
    });
    errors++;
  };

  /** Aplica os campos derivados da RPC de recálculo no equipamento local. */
  const applyRpcToEquipment = async (
    equipmentId: string,
    rpcData: Record<string, unknown>,
    fallbackUpdatedAt?: string,
  ) => {
    const patch: Partial<LocalEquipment> = {
      sincronizado: true,
      statusUpdatePending: undefined,
    };
    if (typeof rpcData.status === 'string') patch.status = rpcData.status as Equipment['status'];
    if (typeof rpcData.data_ultima_inspecao === 'string') patch.dataUltimaInspecao = rpcData.data_ultima_inspecao;
    if (typeof rpcData.data_proxima_inspecao === 'string') patch.dataProximaInspecao = rpcData.data_proxima_inspecao;
    if (typeof rpcData.updated_at === 'string') patch.updatedAt = rpcData.updated_at;
    else if (fallbackUpdatedAt) patch.updatedAt = fallbackUpdatedAt;
    await db.equipamentos.update(equipmentId, patch);
  };

  /** Reconciliação de flags órfãs: equipamentos com `statusUpdatePending` sem
   *  inspeção pendente associada (ex.: exclusão de inspeção já aplicada).
   *  Recálculo idempotente a partir da inspeção mais recente do servidor. */
  const reconcileStaleStatusFlags = async () => {
    const eqs = await db.equipamentos
      .filter((e) => !!e.statusUpdatePending && !e.syncAction && !e.pendingDelete && !e.syncError)
      .toArray();
    if (eqs.length === 0) return;

    // Pula equipamentos que ainda têm inspeções pendentes este round (o RPC
    // normal será executado junto com a inspeção e evita janela de regressão).
    const pendingInspEqIds = new Set<string>();
    const pendingInspections = await db.inspecoes.filter((i) => !i.sincronizado).toArray();
    for (const i of pendingInspections) pendingInspEqIds.add(i.equipmentId);

    for (const eq of eqs) {
      if (pendingInspEqIds.has(eq.id)) continue;
      const rpc = await recalculateEquipmentFromLatestInspectionRemote(eq.id);
      if (rpc.ok && rpc.data) {
        await applyRpcToEquipment(eq.id, rpc.data as Record<string, unknown>);
        if (import.meta.env.DEV) {
          console.log(`[sync] status do equipamento %s reconciliado via inspeções mais recentes`, eq.id);
        }
      } else {
        console.error('[sync] Falha ao reconciliar status do equipamento %s: %s',
          eq.id, rpc.message ?? rpc.code);
        // Mantém statusUpdatePending para a próxima rodada.
      }
    }
  };

  // 1) pending deletes — ADMIN ONLY (RLS) com confirmação de linha.
  const toDelete = await db.inspecoes.filter((i) => !!i.pendingDelete).toArray();
  for (const insp of toDelete) {
    if (!supabase) {
      console.warn('[sync.pushInspections] Supabase não configurado — exclusão local não enviada');
      errors++;
      continue;
    }

    // Verifica conflito antes de excluir (como em equipamentos/planos).
    const remoteResult = await fetchInspectionById(insp.id);
    if (remoteResult.ok && remoteResult.data) {
      const remote = remoteResult.data;
      if (isConflict(insp.syncBaseUpdatedAt, remote.updatedAt)) {
        await markConflict(insp.id, remote.updatedAt ?? null, 'Esta inspeção foi alterada em outro dispositivo antes da exclusão. Revise antes de excluir.');
        continue;
      }
    } else if (!remoteResult.ok && remoteResult.code !== 'not_found') {
      console.error('[sync.pushInspections] Erro ao verificar conflito para exclusão', { id: insp.id });
      errors++;
      continue;
    }

    const { error } = await supabase.from('inspecoes').delete().eq('id', insp.id).select('id').maybeSingle();
    if (!error) {
      await db.inspecoes.delete(insp.id);
      // Recalcula o status do equipamento a partir do restante das inspeções.
      const rpc = await recalculateEquipmentFromLatestInspectionRemote(insp.equipmentId);
      if (rpc.ok && rpc.data) {
        await applyRpcToEquipment(insp.equipmentId, rpc.data as Record<string, unknown>);
      } else {
        // Mantém statusUpdatePending para a reconciliação da próxima rodada.
        await db.equipamentos.update(insp.equipmentId, { sincronizado: false, statusUpdatePending: true });
        console.error('[sync.pushInspections] Falha ao recalcular status do equipamento %s após exclusão',
          insp.equipmentId);
      }
      deleted++;
      if (import.meta.env.DEV) console.log('[sync] Inspeção %s excluída do Supabase (admin)', insp.id);
    } else {
      console.error('[sync.pushInspections] Falha ao deletar inspeção no Supabase', {
        id: insp.id,
        code: error.code,
        message: error.message,
      });
      errors++;
    }
  }

  // 2) pending sync — create / update.
  const pending = await db.inspecoes
    .filter((i) => !i.sincronizado && !i.pendingDelete && !i.syncError)
    .toArray();
  for (const insp of pending) {
    let toSync = insp;
    if (!insp.userId && userId) {
      await db.inspecoes.update(insp.id, { userId });
      toSync = { ...insp, userId };
    }

    const isCreate = insp.syncAction === 'create' || !insp.syncBaseUpdatedAt;
    const rpcEquipmentId = insp.equipmentId;
    const localEq = await db.equipamentos.get(rpcEquipmentId);

    if (isCreate) {
      // CREATE — upsert idempotente com confirmação de linha.
      const created = await upsertInspection(toSync);
      if (!created.ok || !created.row) {
        console.error('[sync] Falha ao criar inspeção %s — %s', insp.id, created.message ?? 'erro desconhecido');
        errors++;
        continue;
      }

      await db.inspecoes.update(insp.id, {
        sincronizado: true,
        syncAction: undefined,
        syncError: undefined,
        syncConflict: false,
        syncConflictReason: undefined,
        syncBaseUpdatedAt: created.row.updated_at,
        updatedAt: created.row.updated_at,
        updatedBy: created.row.updated_by ?? undefined,
        updatedByName: created.row.updated_by_name ?? toSync.updatedByName,
      });

      // Status do equipamento via RPC segura (recálculo pela mais recente).
      const rpc = await recalculateEquipmentFromLatestInspectionRemote(
        rpcEquipmentId,
        localEq?.dataProximaInspecao ?? undefined,
        insp.id,
      );
      if (rpc.ok && rpc.data) {
        await applyRpcToEquipment(rpcEquipmentId, rpc.data as Record<string, unknown>, created.row.updated_at);
      } else {
        // A inspeção foi salva no servidor; o status é reconciliado na próxima
        // rodada sem regressão de dados.
        await db.equipamentos.update(rpcEquipmentId, { sincronizado: false, statusUpdatePending: true });
        console.error('[sync] Inspeção %s criada, mas RPC de status falhou: %s',
          insp.id, rpc.message ?? rpc.code);
      }

      ok++;
      if (import.meta.env.DEV) console.log('[sync] Inspeção %s e status do equipamento %s sincronizados',
        insp.id, rpcEquipmentId);
      continue;
    }

    // UPDATE — CAS com atualização otimista.
    const updated = await updateInspectionRemote({
      id: insp.id,
      data: toSync.data,
      status: toSync.status,
      observacoes: toSync.observacoes,
      updatedByName: toSync.updatedByName,
      syncBaseUpdatedAt: insp.syncBaseUpdatedAt,
    });

    if (!updated.ok) {
      if (updated.code === 'conflict') {
        await markConflict(insp.id, updated.current?.updatedAt ?? null, updated.message);
        continue;
      }
      if (updated.code === 'not_found') {
        await markConflict(insp.id, null, 'Esta inspeção foi excluída no servidor. Revise antes de continuar.');
        continue;
      }
      console.error('[sync] Falha ao atualizar inspeção %s — %s', insp.id, updated.message);
      errors++;
      continue;
    }

    await db.inspecoes.update(insp.id, {
      sincronizado: true,
      syncAction: undefined,
      syncError: undefined,
      syncConflict: false,
      syncConflictReason: undefined,
      remoteUpdatedAtAtConflict: null,
      syncBaseUpdatedAt: updated.row.updated_at,
      updatedAt: updated.row.updated_at,
      updatedBy: updated.row.updated_by ?? undefined,
      updatedByName: updated.row.updated_by_name ?? toSync.updatedByName,
    });

    // Recálculo do status do equipamento (p_trigger = esta inspeção, portanto
    // data_proxima_inspecao é preservada).
    const rpc = await recalculateEquipmentFromLatestInspectionRemote(rpcEquipmentId, undefined, insp.id);
    if (rpc.ok && rpc.data) {
      await applyRpcToEquipment(rpcEquipmentId, rpc.data as Record<string, unknown>, updated.row.updated_at);
    } else {
      await db.equipamentos.update(rpcEquipmentId, { sincronizado: false, statusUpdatePending: true });
      console.error('[sync] Inspeção %s atualizada, mas RPC de status falhou: %s',
        insp.id, rpc.message ?? rpc.code);
    }

    ok++;
    if (import.meta.env.DEV) console.log('[sync] Inspeção %s atualizada (CAS ok) no Supabase', insp.id);
  }

  // 3) Reconciliação de flags de status órfãs (ex.: exclusão em outro
  //    dispositivo já refletida localmente).
  await reconcileStaleStatusFlags();

  if (import.meta.env.DEV) {
    console.log(`[sync] pushInspections final: ok=${ok} errors=${errors} deleted=${deleted}`);
  }
  return { ok, errors, deleted };
}

async function pushActionPlans(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  const markConflict = async (id: string, remoteUpdatedAt: string, reason: string) => {
    if (import.meta.env.DEV) {
      console.log(`[conflict] detected for action plan ${id}: ${reason}`);
    }
    await db.planosAcao.update(id, {
      syncConflict: true,
      syncConflictReason: reason,
      remoteUpdatedAtAtConflict: remoteUpdatedAt,
      syncError: 'conflict',
      sincronizado: false,
    });
  };

  // 1) pending deletes — soft delete com verificação de conflito
  const toDelete = await db.planosAcao.filter((p) => !!p.pendingDelete).toArray();
  for (const plan of toDelete) {
    // Verificar conflito antes de deletar
    const remoteResult = await fetchActionPlanById(plan.id);
    if (remoteResult.ok && remoteResult.data) {
      const remote = remoteResult.data;
      if (remote.deletedAt) {
        // Já deletado remotamente — reconciliar
        await db.planosAcao.update(plan.id, {
          pendingDelete: false,
          sincronizado: true,
          syncAction: undefined,
          syncConflict: false,
          syncConflictReason: undefined,
          syncError: undefined,
          deletedAt: remote.deletedAt,
          deletedBy: remote.deletedBy ?? userId ?? null,
          updatedAt: remote.updatedAt ?? new Date().toISOString(),
        });
        deleted++;
        if (import.meta.env.DEV) console.log('[sync] Plano %s já deletado remotamente — reconciliado', plan.id);
        continue;
      }
      if (isConflict(plan.syncBaseUpdatedAt, remote.updatedAt)) {
        await markConflict(plan.id, remote.updatedAt ?? '', 'Este plano foi alterado em outro dispositivo antes da exclusão. Revise antes de excluir.');
        errors++;
        continue;
      }
    } else if (!remoteResult.ok && remoteResult.code !== 'not_found') {
      console.error('[sync.pushActionPlans] Erro ao verificar conflito para exclusão', { id: plan.id });
      errors++;
      continue;
    }
    const result = await softDeleteActionPlanRemote(plan.id, userId);
    if (result.ok) {
      await db.planosAcao.update(plan.id, {
        pendingDelete: false,
        sincronizado: true,
        syncAction: undefined,
        syncConflict: false,
        syncConflictReason: undefined,
        syncError: undefined,
        deletedAt: new Date().toISOString(),
        deletedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      });
      deleted++;
      if (import.meta.env.DEV) console.log('[sync] Plano %s deletado (soft) do Supabase', plan.id);
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
      if (result.ok) {
        const fetchResult = await fetchActionPlanById(plan.id);
        const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
        await db.planosAcao.update(plan.id, {
          sincronizado: true,
          syncAction: undefined,
          syncError: undefined,
          syncConflict: false,
          syncConflictReason: undefined,
          syncBaseUpdatedAt: remoteUpdatedAt,
          updatedAt: remoteUpdatedAt,
        });
        ok++;
        if (import.meta.env.DEV) console.log('[sync] Plano %s criado com sucesso', plan.id);
      }
    } else if (plan.syncAction === 'update') {
      if (import.meta.env.DEV) {
        console.log(`[conflict] checking action plan ${plan.id}: base=${plan.syncBaseUpdatedAt}`);
      }
      const remoteResult = await fetchActionPlanById(plan.id);
      if (!remoteResult.ok) {
        if (remoteResult.code === 'not_found') {
          result = await createActionPlanRemote(toSync);
          if (result.ok) {
            const fetchResult = await fetchActionPlanById(plan.id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
            await db.planosAcao.update(plan.id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              syncBaseUpdatedAt: remoteUpdatedAt,
              updatedAt: remoteUpdatedAt,
            });
            ok++;
            if (import.meta.env.DEV) console.log('[sync] Plano %s recriado no servidor (não existia)', plan.id);
          }
        } else {
          console.error('[sync.pushActionPlans] Erro ao verificar conflito para update', { id: plan.id });
          errors++;
          continue;
        }
      } else {
        const remote = remoteResult.data!;
        if (import.meta.env.DEV) {
          console.log(`[conflict] remote updated_at=${remote.updatedAt}, local base=${plan.syncBaseUpdatedAt}`);
        }
        if (isConflict(plan.syncBaseUpdatedAt, remote.updatedAt)) {
          await markConflict(plan.id, remote.updatedAt ?? '', 'Este registro foi alterado em outro dispositivo antes da sincronização. Revise antes de continuar.');
          if (import.meta.env.DEV) console.log(`[conflict] update blocked for action plan ${plan.id}`);
        } else {
          if (import.meta.env.DEV) console.log(`[conflict] update allowed for action plan ${plan.id}`);
          result = await updateActionPlanRemote(toSync);
          if (result.ok) {
            const fetchResult = await fetchActionPlanById(plan.id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
            await db.planosAcao.update(plan.id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              syncBaseUpdatedAt: remoteUpdatedAt,
              updatedAt: remoteUpdatedAt,
            });
            ok++;
            if (import.meta.env.DEV) console.log('[sync] Plano %s atualizado com sucesso', plan.id);
          } else {
            console.error('[sync] Falha ao atualizar plano %s — mantendo sincronizado: false', plan.id);
            errors++;
          }
        }
      }
    } else {
      // Legacy — sem syncAction: tenta create; se duplicar, faz update
      const remoteResult = await fetchActionPlanById(plan.id);
      if (remoteResult.ok && remoteResult.data) {
        const remote = remoteResult.data;
        if (isConflict(plan.syncBaseUpdatedAt, remote.updatedAt)) {
          await markConflict(plan.id, remote.updatedAt ?? '', 'Conflito detectado em registro legado. Revise antes de continuar.');
          continue;
        }
        result = await updateActionPlanRemote(toSync);
        if (result.ok) {
          const fetchResult = await fetchActionPlanById(plan.id);
          const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
          await db.planosAcao.update(plan.id, {
            sincronizado: true,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            syncBaseUpdatedAt: remoteUpdatedAt,
            updatedAt: remoteUpdatedAt,
          });
          ok++;
        }
      } else if (!remoteResult.ok && remoteResult.code !== 'not_found') {
        console.error('[sync] Erro ao verificar plano remoto %s', plan.id);
        errors++;
        continue;
      } else {
        result = await createActionPlanRemote(toSync);
        if (result.ok) {
          const fetchResult = await fetchActionPlanById(plan.id);
          const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : new Date().toISOString();
          await db.planosAcao.update(plan.id, {
            sincronizado: true,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            syncBaseUpdatedAt: remoteUpdatedAt,
            updatedAt: remoteUpdatedAt,
          });
          ok++;
        } else if (result.code === 'duplicate') {
          await db.planosAcao.update(plan.id, { syncError: 'duplicate' });
          if (import.meta.env.DEV) console.warn('[sync] Conflito de duplicidade para plano %s — syncError=duplicate', plan.id);
        } else {
          console.error('[sync] Falha ao sincronizar plano %s', plan.id);
          errors++;
        }
      }
    }
  }
  if (import.meta.env.DEV) {
    console.log(`[sync] pushActionPlans final: ok=${ok} errors=${errors} deleted=${deleted}`);
  }
  return { ok, errors, deleted };
}

// ---------------------------------------------------------------------------
// PHOTOS (push)
// ---------------------------------------------------------------------------

/**
 * Push inspection photos to Supabase Storage + `fotos_inspecao`.
 *
 * Ordering guarantees:
 *   • Runs AFTER inspections are pushed (see syncAll): a photo is only sent
 *     when its parent inspection already exists remotely as `sincronizado`,
 *     otherwise it is `skipped` (stays pending for the next round).
 *   • `sincronizado` flips to true ONLY after both the storage object and the
 *     metadata row are confirmed. On storage failure the Blob is preserved
 *     and `syncError` is recorded for the next attempt.
 *   • Idempotent: `storagePath` is written to Dexie immediately after the
 *     upload is confirmed, so a metadata failure keeps `sincronizado` false
 *     but already records the path — the next sync skips the re-upload and
 *     simply retries the `fotos_inspecao` upsert.
 *   • Local-only deletes (`syncAction: 'delete'`) remove both the object and
 *     the metadata row, then delete the local row.
 */
async function pushInspectionPhotos(userId?: string): Promise<{ pushed: number; errors: number; skipped: number }> {
  let pushed = 0;
  let errors = 0;
  let skipped = 0;

  const pending = await db.fotos.filter((p) => !p.sincronizado).toArray();
  if (import.meta.env.DEV && pending.length > 0) {
    console.log(`[sync] pushInspectionPhotos: ${pending.length} pendentes (${pending.map(p => p.id).join(', ')})`);
  }

  for (const photo of pending) {
    // 1) Local-only delete
    if (photo.syncAction === 'delete') {
      try {
        if (supabase) {
          if (photo.storagePath) {
            await removeInspectionPhotoObject(photo.storagePath);
          }
          await supabase.from('fotos_inspecao').delete().eq('id', photo.id);
        }
        await db.fotos.delete(photo.id);
        pushed++;
        if (import.meta.env.DEV) console.log('[sync] Foto %s removida do Supabase', photo.id);
      } catch (err) {
        console.error('[sync.pushInspectionPhotos] falha ao remover foto', { id: photo.id, err });
        errors++;
      }
      continue;
    }

    // 2) Parent inspection must exist and be synced remotely first
    const insp = await db.inspecoes.get(photo.inspectionId);
    if (!insp || !insp.sincronizado || insp.pendingDelete) {
      skipped++;
      continue;
    }

    // 3) Storage path starts with the owner uid
    const sessionData = supabase ? await supabase.auth.getSession() : null;
    const uid = sessionData?.data?.session?.user?.id ?? userId;
    if (!uid) {
      skipped++;
      continue;
    }

    try {
      const ext = mimeToExtension(photo.mimeType || 'image/jpeg');
      const path =
        photo.storagePath ??
        `${uid}/${photo.inspectionId}/${photo.id}.${ext}`;

      if (!photo.storagePath) {
        // Upload object (upsert keeps retries idempotent)
        const blob = getInspectionPhotoBlob(photo);
        const up = await uploadInspectionPhotoBlob(path, blob);
        if (!up.ok) throw new Error(up.error?.message ?? 'Falha ao enviar foto.');

        // Persistir storagePath assim que o upload é confirmado: se o upsert
        // de `fotos_inspecao` falhar logo abaixo, o próximo sync sabe que o
        // objeto já existe e só repete o upsert de metadados — sem reenviar
        // bytes (banda e tempo preservados).
        await db.fotos.update(photo.id, {
          storagePath: path,
          updatedAt: new Date().toISOString(),
        });
      }

      // 4) Metadata row (idempotent upsert on id)
      const { error: metaError } = await supabase!.from('fotos_inspecao').upsert(
        {
          id: photo.id,
          inspection_id: photo.inspectionId,
          storage_path: path,
          mime_type: photo.mimeType ?? 'image/jpeg',
          size_bytes: photo.size ?? null,
          uploaded_at: new Date().toISOString(),
          created_by: uid,
        },
        { onConflict: 'id' },
      );
      if (metaError) throw metaError;

      // 5) Only now confirm locally
      await db.fotos.update(photo.id, {
        sincronizado: true,
        syncAction: undefined,
        syncError: undefined,
        storagePath: path,
        remoteId: photo.id,
        updatedAt: new Date().toISOString(),
      });
      pushed++;
      if (import.meta.env.DEV) {
        console.log('[sync] Foto %s sincronizada: %s (%d bytes)', photo.id, path, photo.size ?? 0);
      }
    } catch (err) {
      const message = (err as { message?: string; code?: string })?.message
        ?? (err as { code?: string })?.code
        ?? 'upload-failed';
      console.error('[sync.pushInspectionPhotos] falha ao enviar foto', { id: photo.id, message });
      await db.fotos.update(photo.id, {
        sincronizado: false,
        syncError: String(message).slice(0, 200),
        updatedAt: new Date().toISOString(),
      });
      errors++;
    }
  }

  if (import.meta.env.DEV) {
    console.log(`[sync] pushInspectionPhotos final: pushed=${pushed} errors=${errors} skipped=${skipped}`);
  }
  return { pushed, errors, skipped };
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
        await db.equipamentos.put({
          ...normalEq,
          sincronizado: true,
          syncBaseUpdatedAt: normalEq.updatedAt ?? null,
        });
        imported++;
        continue;
      }

      // Preservar alterações locais pendentes (incluindo conflitos)
      if (!local.sincronizado || local.pendingDelete || local.syncAction || local.statusUpdatePending || local.syncError || local.syncConflict) {
        continue;
      }

      // Cloud tem tombstone → marcar local como deletado
      if (normalEq.deletedAt) {
        await db.equipamentos.put({
          ...normalEq,
          sincronizado: true,
          pendingDelete: false,
          syncBaseUpdatedAt: normalEq.updatedAt ?? null,
        });
        imported++;
        if (import.meta.env.DEV) console.log('[sync] Equipamento %s marcado como deletado (tombstone remota)', normalEq.id);
        continue;
      }

      // Linha local totalmente sincronizada → sobrescrever com dados do cloud
      await db.equipamentos.put({
        ...normalEq,
        sincronizado: true,
        syncBaseUpdatedAt: normalEq.updatedAt ?? null,
      });
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
      const cloudRow: LocalInspection = {
        ...insp,
        sincronizado: true,
        syncBaseUpdatedAt: insp.updatedAt ?? null,
      };
      if (!local) {
        await db.inspecoes.put(cloudRow);
        imported++;
      } else if (local.sincronizado && !local.pendingDelete && !local.syncConflict) {
        await db.inspecoes.put(cloudRow);
        imported++;
      }
      // else: local has unsynced/conflicting changes — preserve them.
    }

    // --- Reconciliação de órfãos locais ---
    const allLocal = await db.inspecoes.toArray();
    for (const local of allLocal) {
      if (cloudIds.has(local.id)) continue;
      if (!local.sincronizado) continue;
      if (local.pendingDelete) continue;
      // Registro em conflito/erro pendente NUNCA é removido pelo pull.
      if (local.syncConflict || local.syncError || local.syncAction) continue;

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
        await db.planosAcao.put({
          ...plan,
          sincronizado: true,
          syncBaseUpdatedAt: plan.updatedAt ?? null,
        });
        imported++;
        continue;
      }

      // Preservar alterações locais pendentes (incluindo conflitos)
      if (!local.sincronizado || local.pendingDelete || local.syncAction || local.syncError || local.syncConflict) {
        continue;
      }

      // Cloud tem tombstone → marcar local como deletado
      if (plan.deletedAt) {
        await db.planosAcao.put({
          ...plan,
          sincronizado: true,
          pendingDelete: false,
          syncBaseUpdatedAt: plan.updatedAt ?? null,
        });
        imported++;
        if (import.meta.env.DEV) console.log('[sync] Plano %s marcado como deletado (tombstone remota)', plan.id);
        continue;
      }

      // Linha local totalmente sincronizada → sobrescrever com dados do cloud
      await db.planosAcao.put({
        ...plan,
        sincronizado: true,
        syncBaseUpdatedAt: plan.updatedAt ?? null,
      });
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
// PHOTOS (pull) — metadata-only
// ---------------------------------------------------------------------------

/**
 * Import `fotos_inspecao` rows from the cloud.
 *
 * This is metadata-only: image bytes are only downloaded on demand (future
 * detail views). Rules:
 *   • Local rows with unsynced changes (sincronizado:false / syncAction) are
 *     always preserved.
 *   • Remote rows are only materialised when the parent inspection exists
 *     locally (no orphan photo rows).
 *   • Locally-synced rows get their remote metadata refreshed.
 *   • No orphan reconciliation: a local synced photo whose remote row is gone
 *     is kept (evidence must never be destroyed by a sync race).
 */
async function pullInspectionPhotos(): Promise<PullResult> {
  if (import.meta.env.DEV) console.log('[sync] pullInspectionPhotos...');
  if (!supabase) {
    return { imported: 0, reconciled: 0, error: true, empty: false };
  }
  const { data, error } = await supabase.from('fotos_inspecao').select('*');
  if (error) {
    console.error('[sync] pullInspectionPhotos erro: preservando fotos locais');
    return { imported: 0, reconciled: 0, error: true, empty: false };
  }

  const rows = (data ?? []) as DbFotoInspecao[];
  const now = new Date().toISOString();
  let imported = 0;

  for (const row of rows) {
    const local = await db.fotos.get(row.id);
    if (local) {
      if (local.sincronizado) {
        await db.fotos.update(row.id, {
          storagePath: row.storage_path,
          remoteId: row.id,
          sincronizado: true,
          syncError: undefined,
          size: row.size_bytes ?? local.size,
          mimeType: row.mime_type ?? local.mimeType,
          updatedAt: now,
        });
      }
      continue;
    }

    const insp = await db.inspecoes.get(row.inspection_id);
    if (!insp || insp.pendingDelete) continue;

    await db.fotos.put({
      id: row.id,
      inspectionId: row.inspection_id,
      mimeType: row.mime_type ?? 'image/jpeg',
      size: row.size_bytes ?? undefined,
      storagePath: row.storage_path,
      remoteId: row.id,
      sincronizado: true,
      syncAction: undefined,
      createdAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : now,
      updatedAt: now,
    } as LocalInspectionPhoto);
    imported++;
  }

  if (import.meta.env.DEV) {
    console.log('[sync] pullInspectionPhotos final: cloud=%d imported=%d empty=%s',
      rows.length, imported, rows.length === 0 ? 'true' : 'false');
  }
  return { imported, reconciled: 0, error: false, empty: rows.length === 0 };
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
    if (import.meta.env.DEV) console.log('[sync] sync já em andamento — ignorando chamada concorrente');
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
  let pushed = 0;
  let pulled = 0;
  let deleted = 0;
  let errors = 0;

  let pushApOk = 0;
  let pushApErrors = 0;

  let pushPhotoOk = 0;
  let pushPhotoErrors = 0;
  let pushPhotoSkipped = 0;

  let pullEqImported = 0;
  let pullEqReconciled = 0;
  let pullEqError = false;
  let pullEqEmpty = false;

  let pullInsImported = 0;
  let pullInsReconciled = 0;
  let pullInsError = false;
  let pullInsEmpty = false;

  let pullPhotoImported = 0;
  let pullPhotoReconciled = 0;
  let pullPhotoError = false;
  let pullPhotoEmpty = false;

  let pullApImported = 0;
  let pullApReconciled = 0;
  let pullApError = false;
  let pullApEmpty = false;

  try {
    if (!options.pullOnly) {
      const eqR = await pushEquipments(options.userId);
      const insR = await pushInspections(options.userId);
      const phR = await pushInspectionPhotos(options.userId);
      const apR = await pushActionPlans(options.userId);
      pushEqOk = eqR.ok;
      pushInsOk = insR.ok;
      pushPhotoOk = phR.pushed;
      pushPhotoErrors = phR.errors;
      pushPhotoSkipped = phR.skipped;
      pushApOk = apR.ok;
      pushApErrors = apR.errors;
      pushErrors = eqR.errors + insR.errors + phR.errors + apR.errors;
      pushed = pushEqOk + pushInsOk + pushPhotoOk + pushApOk;
      deleted += eqR.deleted + insR.deleted + apR.deleted;
      errors += pushErrors;
    }

    if (!options.pushOnly) {
      const eqP = await pullEquipments();
      const insP = await pullInspections();
      const phP = await pullInspectionPhotos();
      const apP = await pullActionPlans();

      pullEqImported = eqP.imported;
      pullEqReconciled = eqP.reconciled;
      pullEqError = eqP.error;
      pullEqEmpty = eqP.empty;

      pullInsImported = insP.imported;
      pullInsReconciled = insP.reconciled;
      pullInsError = insP.error;
      pullInsEmpty = insP.empty;

      pullPhotoImported = phP.imported;
      pullPhotoReconciled = phP.reconciled;
      pullPhotoError = phP.error;
      pullPhotoEmpty = phP.empty;

      pullApImported = apP.imported;
      pullApReconciled = apP.reconciled;
      pullApError = apP.error;
      pullApEmpty = apP.empty;

      pulled = eqP.imported + insP.imported + phP.imported + apP.imported;
      if (eqP.error || insP.error || phP.error || apP.error) errors++;
    }
  } catch (err) {
    console.error('[sync] exceção durante syncAll:', err);
    errors++;
  } finally {
    if (import.meta.env.DEV) {
      console.log('[sync] ===== RESUMO =====');
      console.log('[sync] ' +
        `Push: eq=${pushEqOk} ins=${pushInsOk} photo=${pushPhotoOk}(skip=${pushPhotoSkipped}) ap=${pushApOk} errors=${pushErrors} | ` +
        `Pull: eq=${pullEqImported}(${pullEqReconciled}) ins=${pullInsImported}(${pullInsReconciled}) photo=${pullPhotoImported}(${pullPhotoReconciled}) ap=${pullApImported}(${pullApReconciled}) | ` +
        `Delete=${deleted} Erros=${errors}`);
    }
    _syncInProgress = false;
    if (import.meta.env.DEV) console.log('[sync] ===== FIM =====');
  }

  return {
    pushed,
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
    pushPhotoOk,
    pushPhotoErrors,
    pushPhotoSkipped,
    pullPhotoImported,
    pullPhotoReconciled,
    pullPhotoError,
    pullPhotoEmpty,
  };
}

/** Counts the rows that still need to be pushed — surfaced in the UI.
 *  Includes conflict rows (syncConflict === true) since they block sync.
 *  Photos whose parent inspection is pending delete (or missing) are not
 *  counted — they cannot be pushed until the inspection exists remotely. */
export async function pendingSyncCount(): Promise<number> {
  const eqs = await db.equipamentos.filter((e) => !e.sincronizado || !!e.pendingDelete).count();
  const ins = await db.inspecoes.filter((i) => !i.sincronizado || !!i.pendingDelete).count();
  const aps = await db.planosAcao.filter((p) => !p.sincronizado || !!p.pendingDelete).count();

  const pendingPhotos = await db.fotos.filter((p) => !p.sincronizado).toArray();
  let photos = 0;
  for (const p of pendingPhotos) {
    const insp = await db.inspecoes.get(p.inspectionId);
    if (insp && !insp.pendingDelete) photos++;
  }

  return eqs + ins + aps + photos;
}

/** Counts rows in conflict (syncConflict === true) for UI badges. */
export async function conflictCount(): Promise<{ equipments: number; actionPlans: number; inspections: number }> {
  const equipments = await db.equipamentos.filter((e) => !!e.syncConflict).count();
  const actionPlans = await db.planosAcao.filter((p) => !!p.syncConflict).count();
  const inspections = await db.inspecoes.filter((i) => !!i.syncConflict).count();
  return { equipments, actionPlans, inspections };
}

// Re-export the mapper helpers for convenience.
export { dbToEquipment, dbToInspection, equipmentToDb, inspectionToDb };
