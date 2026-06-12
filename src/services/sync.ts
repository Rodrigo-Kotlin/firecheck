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
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db, type LocalActionPlan } from '../db';
import { fetchEquipments, upsertEquipment, deleteEquipment } from './equipmentService';
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
import type { ActionPlan } from '../types';

export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  errors: number;
  skipped: boolean;
  reason?: string;
}

function skip(reason: string): SyncReport {
  return { pushed: 0, pulled: 0, deleted: 0, errors: 0, skipped: true, reason };
}

function canSync(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!isSupabaseConfigured || !supabase) return false;
  return true;
}

// ---------------------------------------------------------------------------
// PUSH
// ---------------------------------------------------------------------------

async function pushEquipments(userId?: string): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  // 1) pending deletes
  const toDelete = await db.equipamentos.filter((e) => !!e.pendingDelete).toArray();
  for (const eq of toDelete) {
    const success = await deleteEquipment(eq.id);
    if (success) {
      await db.equipamentos.delete(eq.id);
      deleted++;
    } else {
      console.error('[sync.pushEquipments] Falha ao deletar equipamento no Supabase', {
        id: eq.id,
      });
      errors++;
    }
  }

  // 2) pending upserts
  const pending = await db.equipamentos.filter((e) => !e.sincronizado && !e.pendingDelete).toArray();
  for (const eq of pending) {
    let toUpsert = eq;
    if (!eq.createdBy && userId) {
      await db.equipamentos.update(eq.id, { createdBy: userId });
      toUpsert = { ...eq, createdBy: userId };
    }
    const success = await upsertEquipment(toUpsert);
    if (success) {
      await db.equipamentos.update(eq.id, { sincronizado: true });
      ok++;
    } else {
      console.error('[sync] Falha ao sincronizar equipamento %s — mantendo sincronizado: false', eq.id);
      errors++;
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
    const success = await upsertInspection(toUpsert);
    if (success) {
      await db.inspecoes.update(insp.id, { sincronizado: true });
      ok++;
    } else {
      console.error('[sync] Falha ao sincronizar inspeção %s — mantendo sincronizado: false', insp.id);
      errors++;
    }
  }
  return { ok, errors, deleted };
}

async function pushActionPlans(
  plans: LocalActionPlan[],
  userId?: string,
): Promise<{ ok: number; errors: number; deleted: number }> {
  let ok = 0;
  let errors = 0;
  let deleted = 0;

  // 1) pending deletes
  const toDelete = plans.filter((p) => p.pendingDelete);
  for (const plan of toDelete) {
    const success = await deleteActionPlan(plan.id);
    if (success) {
      deleted++;
    } else {
      errors++;
    }
  }

  // 2) pending upserts
  const pending = plans.filter((p) => !p.sincronizado && !p.pendingDelete);
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
    } else {
      console.error('[sync] Falha ao sincronizar plano de ação %s — mantendo sincronizado: false', plan.id);
      errors++;
    }
  }
  return { ok, errors, deleted };
}

// ---------------------------------------------------------------------------
// PULL
// ---------------------------------------------------------------------------

/** Replace equipment rows from cloud, but never overwrite local unsynced edits.
 *  After importing, remove any local rows that are fully synced (`sincronizado: true`)
 *  but no longer exist in the cloud — the cloud is the source of truth for synced
 *  data. */
async function pullEquipments(): Promise<number> {
  const cloud = await fetchEquipments();
  if (!cloud) return 0;
  const cloudIds = new Set(cloud.map((e) => e.id));
  let pulled = 0;

  await db.transaction('rw', db.equipamentos, async () => {
    // Import / update cloud rows
    for (const eq of cloud) {
      const local = await db.equipamentos.get(eq.id);
      if (!local) {
        await db.equipamentos.put({ ...eq, sincronizado: true });
        pulled++;
      } else if (local.sincronizado && !local.pendingDelete) {
        await db.equipamentos.put({ ...eq, sincronizado: true });
        pulled++;
      }
      // else: local has unsynced changes — preserve them.
    }

    // Purge stale synced rows that no longer exist in the cloud
    const allLocal = await db.equipamentos.toArray();
    for (const local of allLocal) {
      if (!cloudIds.has(local.id) && local.sincronizado && !local.pendingDelete) {
        await db.equipamentos.delete(local.id);
      }
    }
  });

  return pulled;
}

async function pullInspections(): Promise<number> {
  const cloud = await fetchInspections();
  if (!cloud) return 0;
  let pulled = 0;
  await db.transaction('rw', db.inspecoes, async () => {
    for (const insp of cloud) {
      const local = await db.inspecoes.get(insp.id);
      if (!local) {
        await db.inspecoes.put({ ...insp, sincronizado: true });
        pulled++;
      } else if (local.sincronizado && !local.pendingDelete) {
        await db.inspecoes.put({ ...insp, sincronizado: true });
        pulled++;
      }
    }
  });
  return pulled;
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
  if (!canSync()) {
    return skip(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'offline'
        : 'supabase-not-configured',
    );
  }

  let pushed = 0;
  let pulled = 0;
  let deleted = 0;
  let errors = 0;

  try {
    if (!options.pullOnly) {
      const eqR = await pushEquipments(options.userId);
      const insR = await pushInspections(options.userId);
      const apR = await pushActionPlans(localActionPlans, options.userId);
      pushed += eqR.ok + insR.ok + apR.ok;
      deleted += eqR.deleted + insR.deleted + apR.deleted;
      errors += eqR.errors + insR.errors + apR.errors;
    }

    if (!options.pushOnly) {
      const eqP = await pullEquipments();
      const insP = await pullInspections();
      pulled += eqP + insP;
    }
  } catch (err) {
    console.error('[sync] exceção durante syncAll:', err);
    errors++;
  }

  return { pushed, pulled, deleted, errors, skipped: false };
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
