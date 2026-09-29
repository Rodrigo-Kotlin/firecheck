import { db } from '../../db';

/** Counts rows that still need to be pushed, including conflict rows. */
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

/** Counts rows in conflict for UI badges. */
export async function conflictCount(): Promise<{ equipments: number; actionPlans: number; inspections: number }> {
  const equipments = await db.equipamentos.filter((e) => !!e.syncConflict).count();
  const actionPlans = await db.planosAcao.filter((p) => !!p.syncConflict).count();
  const inspections = await db.inspecoes.filter((i) => !!i.syncConflict).count();
  return { equipments, actionPlans, inspections };
}
