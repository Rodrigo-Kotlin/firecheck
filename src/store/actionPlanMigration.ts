import type { ActionPlan } from '../types';
import { db } from '../db';

const MIGRATION_FLAG = 'firecheck_action_plans_migrated_to_dexie';

export async function migratePersistedActionPlansToDexie(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') return;

  try {
    const raw = localStorage.getItem('firecheck-storage');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const plans: ActionPlan[] = parsed?.state?.actionPlans ?? [];
    const meta: Record<string, { sincronizado: boolean; pendingDelete: boolean }> =
      parsed?.state?.actionPlanMeta ?? {};

    if (!Array.isArray(plans) || plans.length === 0) return;

    for (const plan of plans) {
      const exists = await db.planosAcao.get(plan.id);
      if (exists) continue;

      const m = meta[plan.id];
      await db.planosAcao.put({
        ...plan,
        sincronizado: m?.sincronizado ?? true,
        pendingDelete: m?.pendingDelete ?? false,
        syncAction: undefined,
        syncError: undefined,
        deletedAt: undefined,
        updatedAt: undefined,
      });
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
    if (import.meta.env.DEV) {
      console.log(`[store.migration] ${plans.length} planos migrados do localStorage para Dexie`);
    }
  } catch (err) {
    console.error('[store.migration] Erro ao migrar planos:', err);
  }
}
