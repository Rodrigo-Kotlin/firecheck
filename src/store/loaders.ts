import type { ActionPlan, ActionPlanItem } from '../types';
import { db } from '../db';

export async function loadPlansFromDexie(): Promise<ActionPlan[]> {
  const rows = await db.planosAcao
    .filter((p) => !p.pendingDelete && !p.deletedAt)
    .toArray();
  return rows.map(({
    sincronizado: _s, pendingDelete: _p, syncAction: _a, syncOwnerUserId: _o, ...rest
  }) => {
    void _s; void _p; void _a; void _o;
    return rest as ActionPlan;
  });
}

export async function loadPlanItemsFromDexie(): Promise<ActionPlanItem[]> {
  const rows = await db.planosAcaoItens
    .filter((item) => !item.pendingDelete && !item.deletedAt)
    .toArray();
  return rows.map(({
    sincronizado: _s, pendingDelete: _p, syncAction: _a, syncOwnerUserId: _o,
    syncError: _e, syncBaseUpdatedAt: _b, syncConflict: _c,
    syncConflictReason: _r, remoteUpdatedAtAtConflict: _u, ...rest
  }) => {
    void _s; void _p; void _a; void _o; void _e; void _b; void _c; void _r; void _u;
    return rest as ActionPlanItem;
  });
}
