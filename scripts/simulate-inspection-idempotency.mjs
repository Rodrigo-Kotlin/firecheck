#!/usr/bin/env node
/**
 * Simulação standalone da máquina de estados de SUBMISSÃO de inspeções do
 * FireCheck — idempotência e atomicidade da criação.
 *
 * NÃO acessa o Supabase e NÃO depende de credenciais. Replica, em memória, a
 * semântica implementada em `src/store/index.ts`:
 *
 *   • lock síncrono (`submitLockRef`) — atribuição imediata na UI;
 *   • `submissionId`/`inspectionId` estáveis por tentativa (retry reutiliza
 *     os MESMOS IDs — nunca um novo UUID);
 *   • guarda idempotente no store (registro local existente com mesmo id →
 *     sucesso idempotente; contexto diferente → colisão explícita);
 *   • transação Dexie ATOMIICA: INSPEÇÃO + FOTO + EQUIPAMENTO + PLANO DE
 *     AÇÃO na mesma transação — falha em qualquer obrigatório → rollback total;
 *   • plano automático apenas para status `pendente`/`vencido`, ID derivado
 *     `PAC-<inspectionId>` (nunca Date.now/Math.random/UUID);
 *   • plano no caminho idempotente NUNCA sobrescreve plano existente;
 *   • repair controlado: PAC-<inspectionId> ausente → cria SÓ o plano faltante
 *     (sem nova inspeção), retorna idempotent + repairedActionPlan;
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

function inferCriticidade(inspectionObs, eqTipo) {
  const obs = String(inspectionObs || '').toLowerCase();
  const tipo = String(eqTipo || '').toLowerCase();
  if (
    obs.includes('sem carga') || obs.includes('sem lacre') || obs.includes('sem acesso') ||
    obs.includes('sem mangueira') || obs.includes('inoperante') ||
    (tipo.includes('extintor') && obs.includes('vencido'))
  ) return 'Crítico';
  if (obs.includes('sinalização') || obs.includes('mangueira') || obs.includes('abrigo')) return 'Alto';
  if (obs.includes('etiqueta') || obs.includes('sujeira') || obs.includes('avaria')) return 'Médio';
  return 'Baixo';
}

// ---------------------------------------------------------------------------
// "IndexedDB" em memória (put/get/atômic com snapshot/restore).
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
    snapshot: () => new Map(rows),
    restore: (snap) => {
      rows.clear();
      for (const [k, v] of snap) rows.set(k, { ...v });
    },
  };
}

function createRepository({ persistDelayMs = 0, failPlanPut = false, failPersist = false } = {}) {
  return {
    inspecoes: createTable({ delayMs: persistDelayMs }),
    fotos: createTable(),
    planosAcao: createTable(),
    equipamentos: createTable(),
    failPlanPut,
    failPersist,
  };
}

// ---------------------------------------------------------------------------
// Replica de `store.addInspection` (guarda idempotente + repair + transação
// atômica com plano dentro).
// ---------------------------------------------------------------------------
async function addInspection(repo, input) {
  const { inspectionId, equipmentId, status, photo, observacoes } = input;

  // Guarda: mesma tentativa já persistida → caminho idempotente.
  const existing = await repo.inspecoes.get(inspectionId);
  if (existing) {
    if (existing.equipmentId !== equipmentId) {
      return {
        ok: false,
        inspectionSaved: false,
        photoSaved: false,
        error: 'Conflito de tentativa de inspeção (ID já utilizado em outro equipamento).',
      };
    }

    // Foto: persiste na MESMA transação da inspeção (atomicidade) → NÃO há
    // repair de foto.

    // Fortalecimento: pendente/vencido exigem PAC-<inspectionId>.
    if (existing.status === 'pendente' || existing.status === 'vencido') {
      const planId = `PAC-${inspectionId}`;
      const plan = await repo.planosAcao.get(planId);
      if (!plan) {
        // REPARO CONTROLADO: cria SÓ o plano faltante. Nunca sobrescreve.
        const eq = await repo.equipamentos.get(existing.equipmentId);
        const descObs = existing.observacoes || 'Não conformidade identificada durante inspeção';
        await repo.planosAcao.put({
          id: planId,
          equipmentId: existing.equipmentId,
          local: eq?.local || 'Local não especificado',
          descricao: descObs,
          criticidade: inferCriticidade(descObs, eq?.tipo || ''),
          responsavel: '',
          prazo: '',
          status: 'Aberta',
          sincronizado: false,
          syncAction: 'create',
        });
        return { ok: true, inspectionSaved: true, photoSaved: true, inspectionId, idempotent: true, repairedActionPlan: true };
      }
      // Plano existe → idempotente simples (sem tocar em nada).
    }
    return { ok: true, inspectionSaved: true, photoSaved: true, inspectionId, idempotent: true };
  }

  const photoId = photo ? `FOTO-${inspectionId}` : undefined;
  const needsPlan = status === 'pendente' || status === 'vencido';

  // "Transação" atômica com rollback total se qualquer gravação obrigatória
  // falhar (inclusive o plano) — §5/§7/§16/§22/§23.
  const snapshots = {
    inspecoes: repo.inspecoes.snapshot(),
    fotos: repo.fotos.snapshot(),
    equipamentos: repo.equipamentos.snapshot(),
    planosAcao: repo.planosAcao.snapshot(),
  };

  try {
    if (repo.failPersist) {
      repo.failPersist = false; // só falha a primeira tentativa
      throw new Error('Falha simulada de persistência (transação abortada)');
    }
    await repo.inspecoes.put({ id: inspectionId, equipmentId, status, observacoes, sincronizado: false, syncAction: 'create' });
    if (photoId) {
      await repo.fotos.put({ id: photoId, inspectionId, sincronizado: false, syncAction: 'create' });
    }
    await repo.equipamentos.put({ id: equipmentId, status, sincronizado: false, statusUpdatePending: true });

    if (needsPlan) {
      if (repo.failPlanPut) {
        repo.failPlanPut = false; // só falha a primeira tentativa (retry converge)
        throw new Error('Falha simulada de planosAcao.put');
      }
      await repo.planosAcao.put({
        id: `PAC-${inspectionId}`,
        equipmentId,
        status: 'Aberta',
        sincronizado: false,
        syncAction: 'create',
      });
    }
  } catch (err) {
    // Rollback TOTAAL: nada persiste.
    for (const t of ['inspecoes', 'fotos', 'equipamentos', 'planosAcao']) {
      repo[t].restore(snapshots[t]);
    }
    return { ok: false, inspectionSaved: false, photoSaved: !photo, error: err.message };
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
    /** Retorna sempre: { accepted, ok?, idempotent?, repairedActionPlan?, inspectionId?, error? } */
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
  await repo.equipamentos.put({ id: EQ, local: 'Local A', tipo: 'Extintor' });
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

// 5) Retry após erro de persistência genérica: primeira falha, retry MESMO id.
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
  const res = await addInspection(repo, {
    inspectionId: r1.inspectionId,
    equipmentId: 'E-002',
    status: 'regular',
  });
  check('[colisão] erro explícito, sem registro novo', !res.ok && repo.inspecoes.size() === 1);
}

// 11) FALHA TRANSACIONAL DO PLANO — rollback total + retry converge (§16).
{
  const repo = createRepository({ failPlanPut: true });
  await repo.equipamentos.put({ id: EQ, statusText: 'regular', status: 'regular' });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', photo: { blob: 1 } });
  check('[rollback plano] 1ª tentativa falhou (ok=false)', r1.accepted && !r1.ok);
  check('[rollback plano] inspeções = 0', repo.inspecoes.size() === 0);
  check('[rollback plano] fotos = 0', repo.fotos.size() === 0);
  check('[rollback plano] planos = 0', repo.planosAcao.size() === 0);
  check('[rollback plano] equipamento continua regular', repo.equipamentos.rows()[0]?.status === 'regular');

  const r2 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', photo: { blob: 1 } });
  check('[rollback plano] retry aceito e ok', r2.accepted && r2.ok);
  check('[rollback plano] retry mesmo inspectionId', r1.inspectionId === r2.inspectionId);
  check('[rollback plano] 1 inspeção final', repo.inspecoes.size() === 1);
  check('[rollback plano] 1 plano final (PAC-<id>)', repo.planosAcao.size() === 1 && repo.planosAcao.rows()[0]?.id === `PAC-${r1.inspectionId}`);
}

// 12) REPAIR — PAC ausente; re-entrada da MESMA tentativa cria SÓ o plano (§12/§17).
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ, local: 'Local X', tipo: 'Extintor' });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', observacoes: 'sem lacre' });
  // Simula falha parcial de versão anterior: remove o plano, mantém a inspeção.
  repo.planosAcao.restore(new Map());
  // Re-entrada da MESMA tentativa no nível do store (independente do lock de UI).
  const r2 = await addInspection(repo, {
    inspectionId: r1.inspectionId,
    equipmentId: EQ,
    status: 'pendente',
    observacoes: 'sem lacre',
  });
  check('[repair] nenhuma nova inspeção', repo.inspecoes.size() === 1);
  check('[repair] plano criado', repo.planosAcao.size() === 1);
  check('[repair] retorno idempotent + repaired', r2.idempotent === true && r2.repairedActionPlan === true);
  check('[repair] mesmo inspectionId', r1.inspectionId === r2.inspectionId);
  check('[repair] id do plano derivado', repo.planosAcao.rows()[0]?.id === `PAC-${r1.inspectionId}`);
}

// 13) PLANO EXISTENTE não é sobrescrito (§13/§18).
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', observacoes: 'sem lacre' });
  // Usuário preencheu o plano (responsável/prazo/status).
  const planId = `PAC-${r1.inspectionId}`;
  await repo.planosAcao.put({
    id: planId,
    equipmentId: EQ,
    local: 'Local X',
    descricao: 'sem lacre',
    criticidade: 'Crítico',
    responsavel: 'Fulano',
    prazo: '2026-10-01',
    status: 'Em andamento',
    sincronizado: false,
    syncAction: 'update',
  });
  // Re-entrada da MESMA tentativa.
  const r2 = await addInspection(repo, {
    inspectionId: r1.inspectionId,
    equipmentId: EQ,
    status: 'pendente',
    observacoes: 'sem lacre',
  });
  const plan = repo.planosAcao.rows().find((p) => p.id === planId);
  check('[plano existente] idempotente simples', r2.idempotent === true && r2.repairedActionPlan !== true);
  check('[plano existente] responsavel preservado', plan.responsavel === 'Fulano');
  check('[plano existente] prazo preservado', plan.prazo === '2026-10-01');
  check('[plano existente] status preservado', plan.status === 'Em andamento');
  check('[plano existente] não resetou para Aberta', plan.status !== 'Aberta');
  check('[plano existente] 1 único plano', repo.planosAcao.size() === 1);
}

// 14) REGULAR não gera plano (§19).
{
  const repo = createRepository();
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  await ctrl.attempt({ equipmentId: EQ, status: 'regular' });
  check('[regular] inspeção criada', repo.inspecoes.size() === 1);
  check('[regular] plano não criado', repo.planosAcao.size() === 0);
}

// 15) PENDENTE gera exatamente 1 plano; double-click continua 1+1 (§20).
{
  const repo = createRepository({ persistDelayMs: 25 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente' });
  await ctrl.attempt({ equipmentId: EQ, status: 'pendente' });
  check('[pendente] 1 inspeção', repo.inspecoes.size() === 1);
  check('[pendente] 1 plano', repo.planosAcao.size() === 1);
  check('[pendente] PAC-<inspectionId>', repo.planosAcao.rows()[0]?.id === `PAC-${r1.inspectionId}`);
}

// 16) VENCIDO gera exatamente 1 plano (§21).
{
  const repo = createRepository({ persistDelayMs: 20 });
  await repo.equipamentos.put({ id: EQ });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'vencido' });
  await ctrl.attempt({ equipmentId: EQ, status: 'vencido' });
  check('[vencido] 1 inspeção', repo.inspecoes.size() === 1);
  check('[vencido] 1 plano', repo.planosAcao.size() === 1);
  check('[vencido] PAC-<inspectionId>', repo.planosAcao.rows()[0]?.id === `PAC-${r1.inspectionId}`);
}

// 17) FOTO + pendente — sucesso 1/1/1; falha no plano → 0/0/0 (§22).
{
  const repo = createRepository({ failPlanPut: true });
  await repo.equipamentos.put({ id: EQ, local: 'Local Z' });
  const ctrl = createSubmissionController(repo);
  const r1 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', photo: { blob: 1 } });
  check('[foto+pendente] falhou por plano', r1.accepted && !r1.ok);
  check('[foto+pendente] inspeção = 0', repo.inspecoes.size() === 0);
  check('[foto+pendente] foto = 0', repo.fotos.size() === 0);
  check('[foto+pendente] plano = 0', repo.planosAcao.size() === 0);

  const r2 = await ctrl.attempt({ equipmentId: EQ, status: 'pendente', photo: { blob: 1 } });
  check('[foto+pendente] retry ok', r2.accepted && r2.ok);
  check('[foto+pendente] 1 inspeção', repo.inspecoes.size() === 1);
  check('[foto+pendente] 1 foto', repo.fotos.size() === 1);
  check('[foto+pendente] 1 plano', repo.planosAcao.size() === 1);
  check('[foto+pendente] mesmo inspectionId', r1.inspectionId === r2.inspectionId);
}

// 18) EQUIPAMENTO — rollback devolve status original (§23).
{
  const repo = createRepository({ failPlanPut: true });
  await repo.equipamentos.put({ id: EQ, local: 'Local W', status: 'regular' });
  const ctrl = createSubmissionController(repo);
  await ctrl.attempt({ equipmentId: EQ, status: 'vencido' });
  const eq = repo.equipamentos.rows()[0];
  check('[equipamento] regular antes', eq.status === 'regular');
  check('[equipamento] 1ª tentativa falhou', repo.inspecoes.size() === 0 && repo.planosAcao.size() === 0);
  const r2 = await ctrl.attempt({ equipmentId: EQ, status: 'vencido' });
  check('[equipamento] retry ok → pendente', r2.accepted && r2.ok && repo.equipamentos.rows()[0]?.status === 'vencido');
}

// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log('TODOS OS CENÁRIOS PASSARAM.');
} else {
  console.log(`${failures} cenários FALHARAM.`);
  process.exitCode = 1;
}