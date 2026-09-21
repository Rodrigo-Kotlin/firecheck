import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (path) => fs.readFile(new URL(path, root), 'utf8');

async function main() {
  const [app, guards, db, sync, mappers, pagination] = await Promise.all([
    read('src/App.tsx'),
    read('src/components/auth/RouteGuards.tsx'),
    read('src/db/index.ts'),
    read('src/services/sync.ts'),
    read('src/services/mappers.ts'),
    read('src/services/pagination.ts'),
  ]);

  assert.match(app, /path="\/qrcodes\/imprimir"[\s\S]*?<ProtectedRoute>/);
  assert.match(app, /path="admin\/usuarios"[\s\S]*?<AdminRoute>/);
  assert.match(guards, /authReady/);
  assert.match(guards, /isAdmin\(user\)/);
  console.log('PASS route guard assumptions');

  assert.match(pagination, /PULL_PAGE_SIZE = 500/);
  assert.match(pagination, /MAX_PAGES = 2000/);
  assert.match(pagination, /complete = true/);
  assert.match(pagination, /complete = false/);
  for (const domain of ['fetchEquipments', 'fetchInspections', 'fetchActionPlans']) {
    assert.match(await read(domain === 'fetchEquipments'
      ? 'src/services/equipmentService.ts'
      : domain === 'fetchInspections' ? 'src/services/inspectionService.ts' : 'src/services/actionPlanService.ts'), /fetchAllPages/);
  }
  assert.match(sync, /from\('fotos_inspecao'\)[\s\S]*?\.range\(from, to\)/);
  assert.match(sync, /if \(!result\.complete\) return/);
  console.log('PASS pagination and partial-snapshot assumptions');

  assert.match(db, /this\.version\(8\)/);
  assert.match(db, /syncOwnerUserId/);
  const v8Start = db.indexOf('// v8');
  const v8 = db.slice(v8Start, db.indexOf('\n  }', v8Start));
  assert.doesNotMatch(v8, /\.clear\(|\.delete\(|bulkDelete/);
  assert.match(sync, /ownsPending/);
  for (const domain of ['equipment', 'inspection', 'action-plan', 'photo']) {
    assert.match(sync, new RegExp(`ownsPending\\([^\\n]+${domain}`));
  }
  assert.match(mappers, /'syncOwnerUserId'/);
  console.log('PASS ownership and non-destructive Dexie assumptions');

  console.log('\nAutomático: PASS');
  console.log('Manual: browser route navigation, offline F5, real cross-account Dexie E2E, high-resolution physical photo test');
}

main().catch((error) => {
  console.error('Preproduction security: FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
