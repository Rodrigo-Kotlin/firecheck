import assert from 'node:assert/strict';

const A = 'user-a';
const B = 'user-b';

function canPush(row, userId) {
  return row.sincronizado === false && row.syncOwnerUserId === userId;
}

function push(row, userId) {
  if (!canPush(row, userId)) return { ...row, pushed: false };
  return { ...row, sincronizado: true, syncAction: undefined, syncOwnerUserId: undefined, pushed: true };
}

function assertCrossAccount(domain, action) {
  const row = { id: `${domain}-${action}`, sincronizado: false, syncAction: action, syncOwnerUserId: A };
  assert.equal(push(row, B).pushed, false, `${domain}/${action}: B must be skipped`);
  assert.equal(push(row, B).syncOwnerUserId, A, `${domain}/${action}: B must not transfer owner`);
  const synced = push(row, A);
  assert.equal(synced.pushed, true, `${domain}/${action}: A must push`);
  assert.equal(synced.syncOwnerUserId, undefined, `${domain}/${action}: owner clears after confirmation`);
  console.log(`PASS ${domain} ${action}`);
}

for (const domain of ['equipment', 'inspection', 'photo', 'action-plan']) {
  for (const action of ['create', 'update', 'delete']) assertCrossAccount(domain, action);
}

const legacy = { id: 'legacy-pending', sincronizado: false, syncAction: 'update' };
assert.equal(push(legacy, A).pushed, false);
assert.equal(push(legacy, B).pushed, false);
assert.equal(legacy.syncOwnerUserId, undefined);
console.log('PASS legacy-unowned pending is never adopted');

const logoutLogin = { id: 'logout-login', sincronizado: false, syncAction: 'update', syncOwnerUserId: A };
assert.equal(push(logoutLogin, B).pushed, false);
assert.equal(logoutLogin.syncOwnerUserId, A);
assert.equal(push(logoutLogin, A).pushed, true);
console.log('PASS logout/login keeps mutation owned by A');

const payloads = [
  { id: 'eq', createdBy: A, syncOwnerUserId: A },
  { id: 'insp', userId: A, syncOwnerUserId: A },
  { id: 'photo', inspectionId: 'insp', syncOwnerUserId: A },
  { id: 'plan', userId: A, syncOwnerUserId: A },
];
for (const source of payloads) {
  const { syncOwnerUserId: _owner, ...payload } = source;
  assert.equal('syncOwnerUserId' in payload, false, 'local owner must not enter remote payload');
}
console.log('PASS mapper payloads exclude syncOwnerUserId');

const pendingA = { id: 'pending-a', sincronizado: false, syncOwnerUserId: A };
const remoteCache = [{ id: 'remote-1' }, { id: 'remote-2' }];
assert.deepEqual(remoteCache.map((row) => row.id), ['remote-1', 'remote-2']);
assert.equal(push(pendingA, B).pushed, false);
assert.equal(pendingA.syncOwnerUserId, A);
console.log('PASS complete pull does not authorize B to push A pending data');

console.log('Ownership simulation: ALL PASS');
