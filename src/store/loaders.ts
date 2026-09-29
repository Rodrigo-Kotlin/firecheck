import type { ActionPlan } from '../types';
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
