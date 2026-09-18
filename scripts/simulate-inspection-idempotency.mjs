#!/usr/bin/env node
/**
 * Simulação standalone da máquina de estados de SUBMISSÃO de inspeções do
 * FireCheck — idempotência da criação.
 *
 * NÃO acessa o Supabase e NÃO depende de credenciais. Replica, em memória, a
 * semântica implementada:
 *
 *   • lock síncrono (`submitLockRef`) — atribuição imediata na UI;
 *   • `submissionId`/`inspectionId` estáveis por tentativa (retry reutiliza
 *     os MESMOS IDs — nunca um novo UUID);
 *   • guarda idempotente no store (registro local existente com mesmo id →
 *     sucesso idempotente; contexto diferente → colisão explícita);
 *   • foto com ID derivado (`FOTO-<inspectionId>`);
 *   • plano de ação com ID derivado (`PAC-<inspectionId>`);
 *   • "Nova Inspeção" → reset total (novo submissionId + novo inspectionId).
 *
 * Uso:
 *   node scripts/simulate-inspection-idempotency.mjs
 */

import { randomUUID } from 'node:crypto';

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
    failures++;
    console.log(`[FAIL] ${label}`);
  }
}

// ---------------------------------------------------------------------------
// "IndexedDB" em memória (put/get com a mesma semântica de chave primária).
// ---------------------------------------------------------------------------
function createTable({ delayMs = 0 } = {}) {
  const rows = new Map();
  return {
    size: () => rows.size,
    rows: () => [...rows.values()],
    async get(id) {
      return rows.get(id) ?? null;
    },
    async put(row) {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      rows.set(row.id, { ...row });
    },
  };
}

function createRepository({ persistDelayMs = 0, failPersist = false } = {}) {
  return {
    inspecoes: createTable({ delayMs: persistDelayMs }),
    fotos: createTable(),
    planosAcao: createTable(),
    equipamentos: createTable(),
    failPersist,
  };
}

// ---------------------------------------------------------------------------
// Replica de `store.addInspection` (guarda idempotente + transação atômica +
// foto/plano com IDs derivados + equipamento).
// ---------------------------------------------------------------------------
async function addInspection(repo, input) {
  const { inspectionId, equipmentId, status, photo } = input;

  // Guarda: mesma tentativa já persistida → sucesso idempotente.
  const existing = await repo.inspecoes.get(inspectionId);
  if (existing) {
    if (existing.equipmentId === equipmentId) {
      return { ok: true, inspectionSaved: true, photoSaved: true, inspectionId, idempotent: true };
    }
    return {
      ok: false,
      inspectionSaved: false,
      photoSaved: false,
      error: 'Conflito de tentativa de inspeção (ID já utilizado em outro equipamento).',
    };
  }

  const photoId = photo ? `FOTO-${inspectionId}` : undefined;

  // "Transação" — em caso de falha, nada é gravado (rollback total).
  if (repo.failPersist) {
    repo.failPersist = false; // só falha a primeira tentativa (retry converge)
    return { ok: false, inspectionSaved: false, photoSaved: !photo, error: 'Falha simulada de persistência.' };
  }

  await repo.inspecoes.put({ id: inspectionId, equipmentId, status, sincronizado: false, syncAction: 'create' });
  if (photoId) await repo.fotos.put({ id: photoId, inspectionId, sincronizado: false, syncAction: 'create' });
  await repo.equipamentos.put({ id: equipmentId, status, sincronizado: false, statusUpdatePending: true });

  if (status === 'vencido' || status === 'pendente') {
    await repo.planosAcao.put({
      id: `PAC-${inspectionId}`,
      equipmentId,
      status: 'Aberta',
      sincronizado: false,
      syncAction: 'create',
    });
  }

  return { ok: true, inspectionSaved: true, photoSaved: true, inspectionId };
}

// ---------------------------------------------------------------------------
// Replica do controlador de submissão da UI (`handleFinalize` + refs).
// ---------------------------------------------------------------------------
function createSubmissionController(repo) {
  let locked = false;
  let submissionId = null;
  let inspectionId = null;

  return {
    /** Retorna sempre: { accepted, ok?, idempotent?, inspectionId?, error? } */
    async attempt(input) {
      if (locked) return { accepted: false, inspectionId };
      locked = true;
      submissionId ??= randomUUID();
      inspectionId ??= `INSP-${submissionId}`;
      const result = await addInspection(repo, { ...input, inspectionId });
      if (!result.ok) locked = false; // erro → libera lock (retry da MESMA tentativa)
      return { accepted: true, inspectionId, ...result };
    },
    async newInspection(input) {
      locked = false;
      submissionId = null;
      inspectionId = null;
      return this.attempt(input);
    },
  };
}

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

const EQ = 'E-001';

// 1) Um clique.
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular', photo: { blob: 1 } });
  check('[1 clique] aceito uma vez', r1.accepted && r1.ok);
  check('[1 clique] 1 inspeção', repo.inspecoes.size() === 1);
  check('[1 clique] 1 foto', repo.fotos.size() === 1);
}

// 2) Duplo clique (persistência lenta: segundo evento chega com o 1º em voo).
{
  const repo = createRepository({ persistDelayMs: 30 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const [r1, r2] = await Promise.all([
    ctrl.attempt({ equipmentId: EQ, status: 'regular' }),
    ctrl.attempt({ equipmentId: EQ, status: 'regular' }),
  ]);
  check('[duplo clique] apenas 1 accepted', r1.accepted === true && r2.accepted === false);
  check('[duplo clique] 1 inspeção', repo.inspecoes.size() === 1);
  check('[duplo clique] 1 registro por tentativa', repo.inspecoes.rows()[0]?.id === r1.inspectionId);
}

// 3) Triplo clique.
{
  const repo = createRepository({ persistDelayMs: 30 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const [r1, r2, r3] = await Promise.all([
    ctrl.attempt({ equipmentId: EQ, status: 'regular' }),
    ctrl.attempt({ equipmentId: EQ, status: 'regular' }),
    ctrl.attempt({ equipmentId: EQ, status: 'regular' }),
  ]);
  const accepted = [r1, r2, r3].filter((r) => r.accepted).length;
  check('[triplo clique] apenas 1 accepted', accepted === 1);
  check('[triplo clique] 1 inspeção', repo.inspecoes.size() === 1);
}

// 4) Enter repetido (submits sequenciais imediatos).
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  let accepted = 0;
  for (let i = 0; i < 5; i++) {
    const r = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
    if (r.accepted) accepted++;
  }
  check('[enter repetido] apenas 1 aceito', accepted === 1);
  check('[enter repetido] 1 inspeção', repo.inspecoes.size() === 1);
}

// 5) Retry após erro: primeira persistência falha, retry reutiliza MESMO id.
{
  const repo = createRepository({ failPersist: true });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  check('[retry] 1ª tentativa falhou (ok=false)', r1.accepted && !r1.ok);
  const r2 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  check('[retry] 2ª tentativa aceita e ok', r2.accepted && r2.ok);
  check('[retry] mesmo inspectionId', r1.inspectionId === r2.inspectionId);
  check('[retry] 1 inspeção', repo.inspecoes.size() === 1);
}

// 6) Offline (persistência local): reconexão futura sincroniza o MESMO id.
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  const r2 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' }); // double-tap offline
  check('[offline] 1 inspeção local', repo.inspecoes.size() === 1);
  check('[offline] 2º submit bloqueado pelo lock (mesmo id preservado)', !r2.accepted && r1.inspectionId === r2.inspectionId);
}

// 7) Foto: mesmo id de tentativa → mesmo id de foto.
{
  const repo = createRepository({ persistDelayMs: 20 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular', photo: { blob: 1 } });
  await ctrl.attempt({ equipmentId: EQ, status: 'regular', photo: { blob: 1 } });
  check('[foto] 1 metadata de foto', repo.fotos.size() === 1);
  check('[foto] id derivado FOTO-<inspectionId>', repo.fotos.rows()[0]?.id === `FOTO-${r1.inspectionId}`);
}

// 8) Plano de ação: status pendente + múltiplos submits → 1 plano.
{
  const repo = createRepository({ persistDelayMs: 20 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente' });
  await ctrl.attempt({ equipmentId: EQ, status: 'pendente' });
  check('[plano] 1 plano de ação', repo.planosAcao.size() === 1);
  check('[plano] id derivado PAC-<inspectionId>', repo.planosAcao.rows()[0]?.id === `PAC-${r1.inspectionId}`);
}

// 9) Nova inspeção legítima: mesmo equipamento/conteúdo → NOVO id.
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', observacoes: 'A' });
  const rNew = await ctrl.newInspection({ equipmentId: EQ, status: 'pendente', observacoes: 'A' });
  check('[nova inspeção] aceita e ok', rNew.accepted && rNew.ok);
  check('[nova inspeção] novo inspectionId', rNew.inspectionId !== r1.inspectionId);
  check('[nova inspeção] 2 inspeções legítimas', repo.inspecoes.size() === 2);
}

// 10) Colisão de contexto: mesmo id jamais gera outro registro em silêncio.
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  // Tenta reutilizar o MESMO id (como chegaria de um retry externo) com outro equipamento.
  const res = await addInspection(repo, {
    inspectionId: r1.inspectionId,
    equipmentId: 'E-002',
    status: 'regular',
  });
  check('[colisão] erro explícito, sem registro novo', !res.ok && repo.inspecoes.size() === 1);
}

// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log('TODOS OS CENÁRIOS PASSARAM.');
} else {
  console.log(`${failures} cenários FALHARAM.`);
  process.exitCode = 1;
}