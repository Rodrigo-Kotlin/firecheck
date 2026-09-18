#!/usr/bin/env node
/**
 * Simulação standalone da máquina de estados de concorrência (CAS) usada nas
 * inspeções compartilhadas do FireCheck.
 *
 * NÃO acessa o Supabase e NÃO depende de credenciais. Demonstra, em memória,
 * exatamente a lógica de `updateInspectionRemote` (sempre CAS por `updated_at`)
 * e da resolução "manter local" / "usar servidor".
 *
 * Uso:
 *   node scripts/simulate-inspection-cas.mjs
 */

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
// "Banco" em memória com controle de versão otimista.
// ---------------------------------------------------------------------------
function createStore(initialRow) {
  const rows = new Map([[initialRow.id, { ...initialRow }]]);
  return {
    select(id) {
      const row = rows.get(id);
      return row ? { ...row } : null;
    },
    /** CAS: só grava se updated_at remoto === base. Retorna nº de linhas. */
    casUpdate(id, base, patch) {
      const row = rows.get(id);
      if (!row) return { affected: 0, current: null };
      if (row.updated_at !== base) {
        return { affected: 0, current: { ...row } };
      }
      row.updated_at = nextVersion(row.updated_at);
      Object.assign(row, patch);
      return { affected: 1, current: { ...row } };
    },
    delete(id) {
      return rows.delete(id) ? 1 : 0;
    },
  };
}

let versionCounter = 0;
function nextVersion(previous) {
  versionCounter++;
  return `2026-01-01T00:00:${String(versionCounter).padStart(2, '0')}.000000+00:00`;
}

// ---------------------------------------------------------------------------
// Camada que replica `updateInspectionRemote` (fetch base quando ausente).
// ---------------------------------------------------------------------------
function updateInspectionRemote(store, { id, base, patch }) {
  let effectiveBase = base ?? null;
  if (!effectiveBase) {
    const remote = store.select(id);
    if (!remote) return { ok: false, code: 'not_found' };
    effectiveBase = remote.updated_at;
  }
  const result = store.casUpdate(id, effectiveBase, patch);
  if (result.affected === 1) return { ok: true, row: result.current };
  if (!result.current) return { ok: false, code: 'not_found' };
  return { ok: false, code: 'conflict', current: result.current };
}

// ---------------------------------------------------------------------------
// Cenário
// ---------------------------------------------------------------------------
const V1 = '2026-01-01T00:00:00.000000+00:00';
const store = createStore({
  id: 'INSP-SIM',
  inspetor: 'Inspetor Original',
  user_id: 'uid-original',
  data: '2026-01-01',
  observacoes: 'v1',
  updated_at: V1,
});

console.log('--- Simulação de CAS (compare-and-set) ---\n');

// A e B leem a mesma versão base.
const baseA = store.select('INSP-SIM').updated_at;
const baseB = store.select('INSP-SIM').updated_at;
check('A e B leem a mesma base (V1)', baseA === baseB && baseA === V1);

// A atualiza V1 -> V2.
const resA = updateInspectionRemote(store, {
  id: 'INSP-SIM',
  base: baseA,
  patch: { observacoes: 'editado por A' },
});
check('A atualizou V1 → V2', resA.ok === true);
const V2 = store.select('INSP-SIM').updated_at;

// B tenta usar a base antiga V1 -> conflito (zero linhas).
const resB = updateInspectionRemote(store, {
  id: 'INSP-SIM',
  base: baseB,
  patch: { observacoes: 'editado por B' },
});
check('B foi bloqueado usando V1', resB.ok === false && resB.code === 'conflict');
check('conflito detectado', resB.code === 'conflict');
check('nenhuma sobrescrita silenciosa (conteúdo de A preservado)', store.select('INSP-SIM').observacoes === 'editado por A');

// B carrega V2 (usar servidor / preparar manter local).
const remote = store.select('INSP-SIM');
check('B carregou V2', remote.updated_at === V2);

// B "manter local" usando CAS contra V2 -> V3.
const resB2 = updateInspectionRemote(store, {
  id: 'INSP-SIM',
  base: remote.updated_at,
  patch: { observacoes: 'editado por B (keep-local)' },
});
check('keep-local usando V2 → V3', resB2.ok === true);
check('conteúdo final é o de B', store.select('INSP-SIM').observacoes === 'editado por B (keep-local)');

// Registro legado sem base: a camada obtém a base e então faz CAS.
const baseLess = updateInspectionRemote(store, {
  id: 'INSP-SIM',
  base: null,
  patch: { observacoes: 'legado sem base' },
});
check('CAS sem base faz fetch da base antes do UPDATE', baseLess.ok === true);

console.log('');
if (failures === 0) {
  console.log('RESULTADO: OK — nenhuma sobrescrita silenciosa.');
  process.exit(0);
} else {
  console.log(`RESULTADO: ${failures} verificação(ões) falharam.`);
  process.exit(1);
}
