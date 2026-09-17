#!/usr/bin/env node
/**
 * Validação de integração das inspeções compartilhadas do FireCheck.
 *
 * Executa contra um projeto Supabase (preferencialmente staging/dev) usando a
 * ANON KEY + login real de usuários de teste. NUNCA usa service_role — isso
 * invalidaria a validação de RLS.
 *
 * Pré-requisito: migration 0018 aplicada no ambiente remoto.
 *
 * Uso:
 *   node scripts/validate-inspection-sharing.mjs
 *
 * Variáveis de ambiente (não commitar valores reais — ver .env.test.example):
 *   SUPABASE_URL / SUPABASE_ANON_KEY
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_INSPECTOR_A_EMAIL / TEST_INSPECTOR_A_PASSWORD
 *   TEST_INSPECTOR_B_EMAIL / TEST_INSPECTOR_B_PASSWORD
 *   (opcional) TEST_UNAUTHORIZED_EMAIL / TEST_UNAUTHORIZED_PASSWORD
 *
 * Segurança: senhas nunca são impressas. Dados de teste usam o prefixo
 * `E2E-FIRECHECK-` e são removidos ao final com o cliente admin.
 */
import { createClient } from '@supabase/supabase-js';

const ENV = process.env;
const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_INSPECTOR_A_EMAIL,
  TEST_INSPECTOR_A_PASSWORD,
  TEST_INSPECTOR_B_EMAIL,
  TEST_INSPECTOR_B_PASSWORD,
  TEST_UNAUTHORIZED_EMAIL,
  TEST_UNAUTHORIZED_PASSWORD,
} = ENV;

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(pairs) {
  const missing = pairs.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error('Faltam variáveis de ambiente obrigatórias:');
    for (const k of missing) console.error(`  - ${k}`);
    console.error('\nUse .env.test.example como referência. Abortando sem tocar no banco.');
    process.exit(2);
  }
}

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function login(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login falhou (${label}): ${error.message}`);
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
requireEnv([
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
  ['TEST_ADMIN_EMAIL', TEST_ADMIN_EMAIL],
  ['TEST_ADMIN_PASSWORD', TEST_ADMIN_PASSWORD],
  ['TEST_INSPECTOR_A_EMAIL', TEST_INSPECTOR_A_EMAIL],
  ['TEST_INSPECTOR_A_PASSWORD', TEST_INSPECTOR_A_PASSWORD],
  ['TEST_INSPECTOR_B_EMAIL', TEST_INSPECTOR_B_EMAIL],
  ['TEST_INSPECTOR_B_PASSWORD', TEST_INSPECTOR_B_PASSWORD],
]);

const admin = makeClient();
const inspA = makeClient();
const inspB = makeClient();
const anon = makeClient();
const unauthed = TEST_UNAUTHORIZED_EMAIL ? makeClient() : null;

const RUN = Date.now().toString(36).toUpperCase();
const TAG = `E2E-FIRECHECK-${RUN}`;
const TAG2 = `E2E-FIRECHECK2-${RUN}`;
const createdInspectionIds = [];
const uploadedPaths = [];

function newInspectionId() {
  const id = `INSP-E2E-${RUN}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  createdInspectionIds.push(id);
  return id;
}

async function main() {
  console.log(`\n=== FireCheck · validação de inspeções compartilhadas (run ${RUN}) ===\n`);

  const adminUid = await login(admin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, 'admin');
  const uidA = await login(inspA, TEST_INSPECTOR_A_EMAIL, TEST_INSPECTOR_A_PASSWORD, 'inspectorA');
  const uidB = await login(inspB, TEST_INSPECTOR_B_EMAIL, TEST_INSPECTOR_B_PASSWORD, 'inspectorB');
  let uidUnauthorized = null;
  if (unauthed) {
    try {
      uidUnauthorized = await login(unauthed, TEST_UNAUTHORIZED_EMAIL, TEST_UNAUTHORIZED_PASSWORD, 'unauthorized');
    } catch {
      uidUnauthorized = null;
    }
  }

  // -------------------------------------------------------------------------
  // 1. Pre-flight read-only
  // -------------------------------------------------------------------------
  const pre = await admin.from('inspecoes').select('id, updated_at, created_at, updated_by, updated_by_name').limit(1);
  record('Pre-flight: SELECT inspecoes (admin) ok', !pre.error, pre.error?.message ?? '');

  const { data: colsProbe, error: colsErr } = await admin
    .from('inspecoes')
    .select('updated_by, updated_by_name')
    .limit(1);
  record('Pre-flight: colunas updated_by/updated_by_name existem', !colsErr, colsErr?.message ?? '');

  // -------------------------------------------------------------------------
  // 2. Setup: equipamento de teste (admin)
  // -------------------------------------------------------------------------
  const eqInsert = await admin
    .from('equipamentos')
    .insert({
      id: TAG,
      tipo: 'Extintor',
      local: 'E2E',
      setor: 'E2E',
      status: 'regular',
      created_by: adminUid,
    })
    .select('id')
    .maybeSingle();
  record('Setup: admin cria equipamento de teste', !eqInsert.error && eqInsert.data?.id === TAG, eqInsert.error?.message ?? '');
  if (eqInsert.error) return finish();

  // -------------------------------------------------------------------------
  // 3. RLS — A cria inspeção; autoria gravada
  // -------------------------------------------------------------------------
  const insp1 = newInspectionId();
  const createA = await inspA
    .from('inspecoes')
    .insert({
      id: insp1,
      equipment_id: TAG,
      data: '2026-01-01',
      inspetor: 'Inspector A Test',
      status: 'regular',
      observacoes: 'e2e',
      user_id: uidA,
    })
    .select('*')
    .maybeSingle();
  record('RLS: Inspector A cria inspeção', !createA.error && createA.data?.id === insp1, createA.error?.message ?? '');
  if (createA.error) return finish();

  record('Rastreabilidade: user_id = A', createA.data.user_id === uidA, `user_id=${createA.data.user_id ?? 'null'}`);
  record('Rastreabilidade: inspetor original preservado', createA.data.inspetor === 'Inspector A Test');
  record('Rastreabilidade: updated_by null no INSERT', createA.data.updated_by === null);
  record('Rastreabilidade: updated_by_name null no INSERT', createA.data.updated_by_name === null);
  const base1 = createA.data.updated_at;

  // -------------------------------------------------------------------------
  // 4. RLS — B visualiza
  // -------------------------------------------------------------------------
  const readB = await inspB.from('inspecoes').select('id').eq('id', insp1).maybeSingle();
  record('RLS: Inspector B visualiza inspeção de A', !readB.error && readB.data?.id === insp1, readB.error?.message ?? '');

  // -------------------------------------------------------------------------
  // 5. RLS — B edita via CAS; autoria imutável
  // -------------------------------------------------------------------------
  const updB = await inspB
    .from('inspecoes')
    .update({ observacoes: 'editado por B', updated_by_name: 'Inspector B Test' })
    .eq('id', insp1)
    .eq('updated_at', base1)
    .select('*')
    .maybeSingle();
  record('CAS: B atualiza com base correta (1 linha)', !updB.error && updB.data?.id === insp1, updB.error?.message ?? '');
  if (updB.data) {
    record('Auditoria: user_id de A preservado', updB.data.user_id === uidA);
    record('Auditoria: inspetor de A preservado', updB.data.inspetor === 'Inspector A Test');
    record('Auditoria: created_at preservado', updB.data.created_at === createA.data.created_at);
    record('Auditoria: updated_by = B', updB.data.updated_by === uidB, `updated_by=${updB.data.updated_by ?? 'null'}`);
    record('Auditoria: updated_by_name gravado', updB.data.updated_by_name === 'Inspector B Test');
    record('Auditoria: updated_at avançou', updB.data.updated_at > base1, `${base1} → ${updB.data.updated_at}`);
  }

  // -------------------------------------------------------------------------
  // 6. Imutabilidade (B tenta alterar autoria)
  // -------------------------------------------------------------------------
  const immut = await inspB
    .from('inspecoes')
    .update({ inspetor: 'HACKED', user_id: uidB, equipment_id: TAG2, created_at: new Date().toISOString() })
    .eq('id', insp1)
    .select('*');
  record('Imutabilidade: alterar inspetor/user_id/equipment_id/created_at é rejeitado', Boolean(immut.error), immut.error?.message ?? 'sem erro');

  // -------------------------------------------------------------------------
  // 7. DELETE — inspector negado / admin permitido
  // -------------------------------------------------------------------------
  const delByB = await inspB.from('inspecoes').delete().eq('id', insp1).select('id');
  record('RLS: Inspector B NÃO exclui inspeção', !delByB.error && (delByB.data ?? []).length === 0, delByB.error?.message ?? '');
  const stillThere = await inspB.from('inspecoes').select('id').eq('id', insp1).maybeSingle();
  record('RLS: inspeção continua existindo após tentativa de B', stillThere.data?.id === insp1);

  // -------------------------------------------------------------------------
  // 8. CAS real com dois clientes
  // -------------------------------------------------------------------------
  const insp2 = newInspectionId();
  const create2 = await inspA
    .from('inspecoes')
    .insert({ id: insp2, equipment_id: TAG, data: '2026-01-02', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('*')
    .maybeSingle();
  record('CAS setup: nova inspeção criada', !create2.error, create2.error?.message ?? '');
  const baseA = create2.data.updated_at;
  const baseB = (await inspB.from('inspecoes').select('updated_at').eq('id', insp2).maybeSingle()).data?.updated_at;
  record('CAS: A e B leem a mesma base', baseA === baseB);

  const casA = await inspA
    .from('inspecoes')
    .update({ observacoes: 'A venceu' })
    .eq('id', insp2)
    .eq('updated_at', baseA)
    .select('*')
    .maybeSingle();
  record('CAS: A atualiza (1 linha)', !casA.error && casA.data?.id === insp2);
  const newBaseA = casA.data?.updated_at;

  const casBstale = await inspB
    .from('inspecoes')
    .update({ observacoes: 'B tentou com base antiga' })
    .eq('id', insp2)
    .eq('updated_at', baseB)
    .select('*');
  record('CAS: B com base antiga → 0 linhas (conflito)', !casBstale.error && (casBstale.data ?? []).length === 0);

  const remoteNow = await inspB.from('inspecoes').select('updated_at, observacoes').eq('id', insp2).maybeSingle();
  record('CAS: B detecta remoto divergente', remoteNow.data?.updated_at === newBaseA && remoteNow.data?.observacoes === 'A venceu');

  // Resolução "manter local": B usa a base atual do servidor.
  const casBkeep = await inspB
    .from('inspecoes')
    .update({ observacoes: 'B keep-local' })
    .eq('id', insp2)
    .eq('updated_at', remoteNow.data?.updated_at)
    .select('*')
    .maybeSingle();
  record('Resolução keep-local: B CAS contra a versão atual (1 linha)', !casBkeep.error && casBkeep.data?.id === insp2);

  // -------------------------------------------------------------------------
  // 9. Recálculo — ordem por data/created_at/id (updated_at não conta)
  // -------------------------------------------------------------------------
  await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: null,
    p_trigger_inspection_id: null,
  });

  // Mesmo dia: A (regular) criada antes, B (pendente) criada depois.
  const sameDayA = newInspectionId();
  const sameDayB = newInspectionId();
  await inspA
    .from('inspecoes')
    .insert({ id: sameDayA, equipment_id: TAG, data: '2026-03-01', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('id')
    .maybeSingle();
  await sleep(1200);
  await inspA
    .from('inspecoes')
    .insert({ id: sameDayB, equipment_id: TAG, data: '2026-03-01', inspetor: 'Inspector A Test', status: 'pendente', user_id: uidA })
    .select('id')
    .maybeSingle();

  const recalcSameDay = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: null,
    p_trigger_inspection_id: null,
  });
  const eqSameDay = await admin.from('equipamentos').select('status, data_ultima_inspecao').eq('id', TAG).maybeSingle();
  record('Recálculo: vencedora é a criada depois (mesmo dia)', recalcSameDay.data?.inspection_id === sameDayB, `vencedora=${recalcSameDay.data?.inspection_id ?? 'null'}`);
  record('Recálculo: status do equipamento = pendente', eqSameDay.data?.status === 'pendente');

  // Edição administrativa da inspeção ANTIGA não muda a vencedora.
  const baseSameDayA = (await inspA.from('inspecoes').select('updated_at').eq('id', sameDayA).maybeSingle()).data?.updated_at;
  await inspA
    .from('inspecoes')
    .update({ observacoes: 'só observação' })
    .eq('id', sameDayA)
    .eq('updated_at', baseSameDayA)
    .select('id')
    .maybeSingle();
  const recalcAfterEdit = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: null,
    p_trigger_inspection_id: null,
  });
  const eqAfterEdit = await admin.from('equipamentos').select('status').eq('id', TAG).maybeSingle();
  record('Sem regressão: editar inspeção antiga mantém a vencedora', recalcAfterEdit.data?.inspection_id === sameDayB);
  record('Sem regressão: status continua pendente', eqAfterEdit.data?.status === 'pendente');

  // Alterar a mais recente reflete no equipamento.
  const baseSameDayB = (await inspA.from('inspecoes').select('updated_at').eq('id', sameDayB).maybeSingle()).data?.updated_at;
  await inspA
    .from('inspecoes')
    .update({ status: 'regular' })
    .eq('id', sameDayB)
    .eq('updated_at', baseSameDayB)
    .select('id')
    .maybeSingle();
  const recalcLatestEdit = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: null,
    p_trigger_inspection_id: null,
  });
  const eqLatestEdit = await admin.from('equipamentos').select('status').eq('id', TAG).maybeSingle();
  record('Alterar a mais recente reflete status no equipamento', eqLatestEdit.data?.status === 'regular');

  // -------------------------------------------------------------------------
  // 10. p_next — só aplica quando o trigger é a vencedora
  // -------------------------------------------------------------------------
  const nextDate = '2027-12-31';

  // (A) trigger = vencedora → aplica
  const rpcNextWinner = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: nextDate,
    p_trigger_inspection_id: sameDayB,
  });
  record('p_next (A): trigger vencedora aplica a próxima data', rpcNextWinner.data?.data_proxima_inspecao === nextDate, `proxima=${rpcNextWinner.data?.data_proxima_inspecao ?? 'null'}`);

  // (B) trigger = inspeção antiga → NÃO altera
  const rpcNextOld = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: '2028-01-01',
    p_trigger_inspection_id: sameDayA,
  });
  record('p_next (B): trigger antigo NÃO altera a próxima data', rpcNextOld.data?.data_proxima_inspecao === nextDate, `proxima=${rpcNextOld.data?.data_proxima_inspecao ?? 'null'}`);

  // (C) trigger null → NÃO altera
  const rpcNextNull = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: '2028-02-02',
    p_trigger_inspection_id: null,
  });
  record('p_next (C): trigger null NÃO altera a próxima data', rpcNextNull.data?.data_proxima_inspecao === nextDate, `proxima=${rpcNextNull.data?.data_proxima_inspecao ?? 'null'}`);

  // Trigger de outro equipamento → rejeitado
  const rpcBadTrigger = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG,
    p_next_inspection_date: null,
    p_trigger_inspection_id: 'INSP-INEXISTENTE',
  });
  record('p_trigger inválido é rejeitado', Boolean(rpcBadTrigger.error), rpcBadTrigger.error?.message ?? 'sem erro');

  // Equipamento inexistente → rejeitado (NOEQPT)
  const rpcNoEquipment = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: `${TAG}-INEXISTENTE`,
  });
  record('Equipamento inexistente é rejeitado (NOEQPT)', Boolean(rpcNoEquipment.error), rpcNoEquipment.error?.message ?? 'sem erro');

  // -------------------------------------------------------------------------
  // 11. Autorização da RPC
  // -------------------------------------------------------------------------
  const rpcAdmin = await admin.rpc('recalculate_equipment_from_latest_inspection', { p_equipment_id: TAG });
  record('RPC: admin permitido', !rpcAdmin.error, rpcAdmin.error?.message ?? '');
  const rpcInspector = await inspA.rpc('recalculate_equipment_from_latest_inspection', { p_equipment_id: TAG });
  record('RPC: inspector permitido', !rpcInspector.error, rpcInspector.error?.message ?? '');
  const rpcAnon = await anon.rpc('recalculate_equipment_from_latest_inspection', { p_equipment_id: TAG });
  record('RPC: sem sessão negado', Boolean(rpcAnon.error), rpcAnon.error?.message ?? 'sem erro');
  if (unauthed && uidUnauthorized) {
    const rpcUnauth = await unauthed.rpc('recalculate_equipment_from_latest_inspection', { p_equipment_id: TAG });
    record('RPC: role não autorizada negada', Boolean(rpcUnauth.error), rpcUnauth.error?.message ?? 'sem erro');
  } else {
    console.log('[SKIP] RPC: role não autorizada (sem TEST_UNAUTHORIZED_*)');
  }

  // -------------------------------------------------------------------------
  // 12. Fotos — metadata compartilhada / storage privado
  // -------------------------------------------------------------------------
  const photoInsp = newInspectionId();
  await inspA
    .from('inspecoes')
    .insert({ id: photoInsp, equipment_id: TAG, data: '2026-04-01', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('id')
    .maybeSingle();

  const photoPath = `${uidA}/${photoInsp}/e2e.jpg`;
  uploadedPaths.push(photoPath);
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const upload = await inspA.storage
    .from('inspection-photos')
    .upload(photoPath, new globalThis.Blob([bytes], { type: 'image/jpeg' }), { upsert: true, contentType: 'image/jpeg' });
  record('Fotos: A faz upload no Storage', !upload.error, upload.error?.message ?? '');

  const photoInsert = await inspA
    .from('fotos_inspecao')
    .insert({
      id: `FOTO-E2E-${RUN}`,
      inspection_id: photoInsp,
      storage_path: photoPath,
      mime_type: 'image/jpeg',
      size_bytes: bytes.length,
      created_by: uidA,
    })
    .select('id')
    .maybeSingle();
  record('Fotos: A registra metadata', !photoInsert.error, photoInsert.error?.message ?? '');

  const metaB = await inspB.from('fotos_inspecao').select('id').eq('inspection_id', photoInsp);
  record('Fotos: B vê metadata da inspeção de A', !metaB.error && (metaB.data ?? []).length === 1, metaB.error?.message ?? '');

  const dlB = await inspB.storage.from('inspection-photos').download(photoPath);
  record('Storage: B baixa a foto (compartilhado)', !dlB.error, dlB.error?.message ?? '');

  const dlAnon = await anon.storage.from('inspection-photos').download(photoPath);
  record('Storage: anônimo NEGADO', Boolean(dlAnon.error), dlAnon.error?.message ?? 'sem erro');

  const rlsInspecoesAnon = await anon.from('inspecoes').select('id').eq('id', insp1);
  record('RLS: anônimo não lê inspeções', !rlsInspecoesAnon.error && (rlsInspecoesAnon.data ?? []).length === 0);

  return finish();
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
async function cleanup() {
  console.log('\n--- Limpeza dos dados de teste ---');
  for (const path of uploadedPaths) {
    const r = await admin.storage.from('inspection-photos').remove([path]);
    if (r.error) console.warn(`  aviso: falha ao remover objeto ${path}: ${r.error.message}`);
  }
  const delInsp = await admin.from('inspecoes').delete().like('id', `INSP-E2E-${RUN}%`).select('id');
  if (delInsp.error) console.warn(`  aviso: falha ao remover inspeções: ${delInsp.error.message}`);
  const delEq = await admin.from('equipamentos').delete().in('id', [TAG, TAG2]).select('id');
  if (delEq.error) console.warn(`  aviso: falha ao remover equipamentos: ${delEq.error.message}`);
  console.log('  limpeza concluída.');
}

async function finish() {
  await cleanup();
  const failed = results.filter((r) => !r.ok);
  console.log('\n=== Resumo ===');
  console.log(`Total: ${results.length} · Passou: ${results.length - failed.length} · Falhou: ${failed.length}`);
  if (failed.length) {
    console.log('\nFalhas:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\nErro fatal na validação:', err.message);
  try {
    await cleanup();
  } catch {
    /* noop */
  }
  process.exit(1);
});
