#!/usr/bin/env node
/**
 * FireCheck · Validação comportamental segura de inspeções compartilhadas.
 *
 * Regra absoluta: NENHUM equipamento/QR/inspeção pré-existente pode ser alterado.
 * Todos os testes operam EXCLUSIVAMENTE sobre dados E2E criados nesta rodada.
 *
 * Variáveis (.env.test.local — NUNCA commitar):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_INSPECTOR_A_EMAIL, TEST_INSPECTOR_A_PASSWORD
 *   TEST_INSPECTOR_B_EMAIL, TEST_INSPECTOR_B_PASSWORD
 *   (opcional) TEST_UNAUTHORIZED_EMAIL, TEST_UNAUTHORIZED_PASSWORD
 *
 * Uso:
 *   node --env-file=.env.test.local scripts/validate-inspection-sharing.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// ─── ENV ────────────────────────────────────────────────────────────────────
// Carrega .env.test.local manualmente (suporta # em valores entre aspas)
function loadDotenv(path) {
  try {
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) continue;
      const key = line.substring(0, eqIdx).trim();
      let val = line.substring(eqIdx + 1).trim();
      // Remove aspas duplas ou simples se presentes em ambos os lados
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* arquivo não existe — okay */ }
}
loadDotenv('.env.test.local');

// ─── ENV ────────────────────────────────────────────────────────────────────
const ENV = process.env;
const {
  SUPABASE_URL, SUPABASE_ANON_KEY,
  TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD,
  TEST_INSPECTOR_A_EMAIL, TEST_INSPECTOR_A_PASSWORD,
  TEST_INSPECTOR_B_EMAIL, TEST_INSPECTOR_B_PASSWORD,
  TEST_UNAUTHORIZED_EMAIL, TEST_UNAUTHORIZED_PASSWORD,
} = ENV;

function requireEnv(pairs) {
  const missing = pairs.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error('Faltam variáveis de ambiente:');
    for (const k of missing) console.error(`  - ${k}`);
    process.exit(2);
  }
}
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

// ─── CLIENTS ────────────────────────────────────────────────────────────────
function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const admin = makeClient();
const inspA = makeClient();
const inspB = makeClient();
const anon = makeClient();
const unauthed = TEST_UNAUTHORIZED_EMAIL ? makeClient() : null;

async function login(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login falhou (${label}): ${error.message}`);
  return { uid: data.user.id, session: data.session };
}

// ─── RUN ID & TRACKING ─────────────────────────────────────────────────────
const RUN = Date.now().toString(36).toUpperCase();
const TAG = `E2E-FIRECHECK-${RUN}`;

/** @type {Set<string>} IDs de equipamentos criados NESTA rodada */
const createdTestEquipmentIds = new Set();
/** @type {Set<string>} IDs de inspeções criadas NESTA rodada */
const createdTestInspectionIds = new Set();
/** @type {Set<string>} IDs de fotos criadas NESTA rodada */
const createdTestPhotoIds = new Set();
/** @type {string[]} Paths de storage criados NESTA rodada */
const createdTestStoragePaths = [];

// ─── EXISTING EQUIPMENT SNAPSHOT ────────────────────────────────────────────
/** @type {Array<{id:string, qr_code:string|null, status:string, deleted_at:string|null,
 *   data_ultima_inspecao:string|null, data_proxima_inspecao:string|null, updated_at:string}>} */
let existingEquipmentSnapshot = [];
let existingEquipmentCountBefore = 0;

function newInspectionId() {
  const id = `INSP-E2E-${RUN}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  createdTestInspectionIds.add(id);
  return id;
}

function newPhotoId() {
  const id = `FOTO-E2E-${RUN}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  createdTestPhotoIds.add(id);
  return id;
}

// ─── SAFETY GUARDS ──────────────────────────────────────────────────────────
function assertE2eInspection(id) {
  if (!createdTestInspectionIds.has(id)) {
    throw new Error(`SAFETY BLOCK: tentativa de alterar inspeção que não pertence ao teste E2E: ${id}`);
  }
}
function assertE2eEquipment(id) {
  if (!createdTestEquipmentIds.has(id)) {
    throw new Error(`SAFETY BLOCK: proibido alterar equipamento pré-existente: ${id}`);
  }
}

// ─── RESULT TRACKING ────────────────────────────────────────────────────────
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== FireCheck · Validação comportamental segura (run ${RUN}) ===\n`);

  // =========================================================================
  // §13 — TESTE 1: AUTENTICAÇÃO
  // =========================================================================
  const { uid: adminUid, session: adminSession } = await login(admin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, 'admin');
  const { uid: uidA } = await login(inspA, TEST_INSPECTOR_A_EMAIL, TEST_INSPECTOR_A_PASSWORD, 'inspectorA');
  const { uid: uidB } = await login(inspB, TEST_INSPECTOR_B_EMAIL, TEST_INSPECTOR_B_PASSWORD, 'inspectorB');
  let uidUnauthorized = null;
  if (unauthed) {
    try {
      uidUnauthorized = (await login(unauthed, TEST_UNAUTHORIZED_EMAIL, TEST_UNAUTHORIZED_PASSWORD, 'unauthorized')).uid;
    } catch { uidUnauthorized = null; }
  }
  console.log(`  admin=${adminUid.slice(0,8)}…  A=${uidA.slice(0,8)}…  B=${uidB.slice(0,8)}…`);
  record('TESTE 1: Autenticação de todos os perfis', true);

  // =========================================================================
  // §5 — INVENTÁRIO DE PROTEÇÃO
  // =========================================================================
  console.log('\n--- [SAFETY] Snapshot de equipamentos existentes ---');
  const snap = await admin.from('equipamentos')
    .select('id, qr_code, status, deleted_at, data_ultima_inspecao, data_proxima_inspecao, updated_at')
    .order('id');
  if (snap.error) throw new Error(`Falha ao ler equipamentos: ${snap.error.message}`);
  existingEquipmentSnapshot = snap.data ?? [];
  existingEquipmentCountBefore = existingEquipmentSnapshot.length;
  console.log(`  [SAFETY] ${existingEquipmentCountBefore} equipamentos existentes catalogados`);

  // =========================================================================
  // §14 — TESTE 2: EQUIPAMENTO TEMPORÁRIO
  // =========================================================================
  // §10 — Verificar TAG única antes de criar
  const existingTag = await admin.from('equipamentos').select('id').eq('id', TAG).maybeSingle();
  if (existingTag.data) throw new Error(`TAG ${TAG} já existe — geração de colisão`);

  const eqInsert = await admin
    .from('equipamentos')
    .insert({ id: TAG, tipo: 'Extintor E2E', local: 'E2E-LOCAL', setor: 'E2E-SETOR', status: 'regular', created_by: adminUid })
    .select('id')
    .maybeSingle();
  if (eqInsert.error) throw new Error(`Falha ao criar equipamento E2E: ${eqInsert.error.message}`);
  createdTestEquipmentIds.add(TAG);
  console.log(`  [PASS] Equipamento E2E criado: ${TAG}`);
  record('TESTE 2: Equipamento E2E criado', eqInsert.data?.id === TAG);

  // =========================================================================
  // §15 — TESTE 3: INSPECTOR A CRIA INSPEÇÃO
  // =========================================================================
  const insp1 = newInspectionId();
  assertE2eInspection(insp1);
  const createA = await inspA
    .from('inspecoes')
    .insert({
      id: insp1, equipment_id: TAG, data: '2026-01-01',
      inspetor: 'Inspector A Test', status: 'regular',
      observacoes: 'E2E criação A', user_id: uidA,
    })
    .select('*').maybeSingle();
  if (createA.error) throw new Error(`Falha criar inspeção A: ${createA.error.message}`);
  const base1 = createA.data.updated_at;

  record('TESTE 3: Inspector A criou inspeção', createA.data.id === insp1);
  record('Rastreabilidade: user_id = A', createA.data.user_id === uidA);
  record('Rastreabilidade: inspetor original', createA.data.inspetor === 'Inspector A Test');
  record('Rastreabilidade: updated_by null no INSERT', createA.data.updated_by === null);
  record('Rastreabilidade: updated_by_name null no INSERT', createA.data.updated_by_name === null);
  record('Rastreabilidade: created_at preenchido', Boolean(createA.data.created_at));
  record('Rastreabilidade: updated_at preenchido', Boolean(createA.data.updated_at));

  // =========================================================================
  // §16 — TESTE 4: INSPECTOR B VISUALIZA A
  // =========================================================================
  const readB = await inspB.from('inspecoes').select('*').eq('id', insp1).maybeSingle();
  record('TESTE 4: B visualiza inspeção de A', !readB.error && readB.data?.id === insp1);
  record('  → mesmo equipment_id', readB.data?.equipment_id === TAG);
  record('  → mesmo inspetor original', readB.data?.inspetor === 'Inspector A Test');
  record('  → mesmo user_id original', readB.data?.user_id === uidA);

  // =========================================================================
  // §17 — TESTE 5: INSPECTOR B EDITA A VIA CAS
  // =========================================================================
  assertE2eInspection(insp1);
  const updB = await inspB
    .from('inspecoes')
    .update({ observacoes: 'E2E edição por B', updated_by_name: 'Inspector B Test' })
    .eq('id', insp1)
    .eq('updated_at', base1)
    .select('*').maybeSingle();

  record('TESTE 5: B editou inspeção de A (CAS)', !updB.error && updB.data?.id === insp1, updB.error?.message ?? '');
  if (updB.data) {
    const baseV2 = updB.data.updated_at;
    record('  → user_id continua A', updB.data.user_id === uidA);
    record('  → inspetor continua A', updB.data.inspetor === 'Inspector A Test');
    record('  → equipment_id continua E2E', updB.data.equipment_id === TAG);
    record('  → created_at não mudou', updB.data.created_at === createA.data.created_at);
    record('  → updated_by = B', updB.data.updated_by === uidB);
    record('  → updated_by_name = B', updB.data.updated_by_name === 'Inspector B Test');
    record('  → updated_at avançou', updB.data.updated_at > base1);
  }

  // =========================================================================
  // §18 — TESTE 6: IMUTABILIDADE
  // =========================================================================
  for (const [field, value] of [
    ['user_id', uidB],
    ['inspetor', 'HACKED'],
    ['equipment_id', 'HACKED'],
    ['created_at', new Date().toISOString()],
  ]) {
    const r = await inspB.from('inspecoes').update({ [field]: value }).eq('id', insp1).select('*');
    const stillOriginal = await admin.from('inspecoes').select('*').eq('id', insp1).maybeSingle();
    const ok = Boolean(r.error) && stillOriginal.data?.inspetor === 'Inspector A Test'
      && stillOriginal.data?.user_id === uidA
      && stillOriginal.data?.equipment_id === TAG;
    record(`TESTE 6: Imutabilidade ${field}`, ok, r.error?.message ?? '');
  }

  // =========================================================================
  // §19 — TESTE 7: DELETE POR INSPECTOR (NEGADO)
  // =========================================================================
  const delByB = await inspB.from('inspecoes').delete().eq('id', insp1).select('id');
  record('TESTE 7: Inspector B NÃO exclui inspeção', !delByB.error && (delByB.data ?? []).length === 0);
  const stillThere = await admin.from('inspecoes').select('id').eq('id', insp1).maybeSingle();
  record('  → inspeção continua existindo', stillThere.data?.id === insp1);

  // =========================================================================
  // §20 — TESTE 8: CONCORRÊNCIA CAS
  // =========================================================================
  const inspCAS = newInspectionId();
  assertE2eInspection(inspCAS);
  const createCAS = await inspA
    .from('inspecoes')
    .insert({ id: inspCAS, equipment_id: TAG, data: '2026-01-02', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('*').maybeSingle();
  if (createCAS.error) throw new Error(`Falha criar inspeção CAS: ${createCAS.error.message}`);

  const baseA = createCAS.data.updated_at;
  const baseBread = await inspB.from('inspecoes').select('updated_at').eq('id', inspCAS).maybeSingle();
  const baseB = baseBread.data?.updated_at;
  record('TESTE 8: A e B leem a mesma base', baseA === baseB);

  // A atualiza → sucesso
  assertE2eInspection(inspCAS);
  const casA = await inspA
    .from('inspecoes')
    .update({ observacoes: 'CAS A venceu' })
    .eq('id', inspCAS).eq('updated_at', baseA)
    .select('*').maybeSingle();
  record('CAS: A atualizou (1 linha)', !casA.error && casA.data?.id === inspCAS);
  const newBaseA = casA.data?.updated_at;

  // B tenta com base antiga → conflito
  const casBstale = await inspB
    .from('inspecoes')
    .update({ observacoes: 'CAS B antigo' })
    .eq('id', inspCAS).eq('updated_at', baseB)
    .select('*');
  record('CAS: B com base antiga → conflito (0 linhas)', (casBstale.data ?? []).length === 0);

  // Verificar que remoto continua "CAS A venceu"
  const remoteNow = await inspB.from('inspecoes').select('updated_at, observacoes').eq('id', inspCAS).maybeSingle();
  record('CAS: remoto continua "CAS A venceu"', remoteNow.data?.observacoes === 'CAS A venceu');
  record('CAS: remoto updated_at = newBaseA', remoteNow.data?.updated_at === newBaseA);

  // =========================================================================
  // §21 — TESTE 9: USAR SERVIDOR
  // =========================================================================
  record('TESTE 9: B detecta divergência (UseRemote)', remoteNow.data?.updated_at === newBaseA);

  // =========================================================================
  // §22 — TESTE 10: MANTER LOCAL
  // =========================================================================
  assertE2eInspection(inspCAS);
  const casBkeep = await inspB
    .from('inspecoes')
    .update({ observacoes: 'B keep-local' })
    .eq('id', inspCAS)
    .eq('updated_at', remoteNow.data?.updated_at)
    .select('*').maybeSingle();
  record('TESTE 10: B keep-local com base atual (1 linha)', !casBkeep.error && casBkeep.data?.id === inspCAS);

  // =========================================================================
  // §23 — TESTE 11: CAS SEM BASE (LEGADO)
  // =========================================================================
  const remote = await inspB.from('inspecoes').select('updated_at').eq('id', inspCAS).maybeSingle();
  const baseFromFetch = remote.data?.updated_at;
  assertE2eInspection(inspCAS);
  const legacyCAS = await inspB
    .from('inspecoes')
    .update({ observacoes: 'legacy fetch+cas' })
    .eq('id', inspCAS)
    .eq('updated_at', baseFromFetch)
    .select('*').maybeSingle();
  record('TESTE 11: CAS sem base (fetch primeiro) funciona', !legacyCAS.error && legacyCAS.data?.id === inspCAS);

  // =========================================================================
  // §24 — TESTE 12: DUAS INSPEÇÕES NO MESMO DIA
  // =========================================================================
  const sameDayA = newInspectionId();
  const sameDayB = newInspectionId();
  assertE2eInspection(sameDayA);
  assertE2eInspection(sameDayB);

  await inspA.from('inspecoes')
    .insert({ id: sameDayA, equipment_id: TAG, data: '2026-03-01', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('id').maybeSingle();
  await sleep(1200);
  await inspA.from('inspecoes')
    .insert({ id: sameDayB, equipment_id: TAG, data: '2026-03-01', inspetor: 'Inspector A Test', status: 'pendente', user_id: uidA })
    .select('id').maybeSingle();

  const rpcSameDay = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: null, p_trigger_inspection_id: null,
  });
  const eqAfter = await admin.from('equipamentos').select('status, data_ultima_inspecao').eq('id', TAG).maybeSingle();
  record('TESTE 12: Vencedora é a criada depois (mesmo dia)', rpcSameDay.data?.inspection_id === sameDayB);
  record('  → status = pendente', eqAfter.data?.status === 'pendente');

  // =========================================================================
  // §25 — TESTE 13: EDITAR INSPEÇÃO ANTIGA
  // =========================================================================
  assertE2eInspection(sameDayA);
  const baseSameDayA = (await inspA.from('inspecoes').select('updated_at').eq('id', sameDayA).maybeSingle()).data?.updated_at;
  await inspA.from('inspecoes')
    .update({ observacoes: 'só observação antiga' })
    .eq('id', sameDayA).eq('updated_at', baseSameDayA)
    .select('id').maybeSingle();
  const rpcOld = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: null, p_trigger_inspection_id: null,
  });
  const eqOld = await admin.from('equipamentos').select('status').eq('id', TAG).maybeSingle();
  record('TESTE 13: Editar antiga NÃO muda vencedora', rpcOld.data?.inspection_id === sameDayB);
  record('  → status continua pendente', eqOld.data?.status === 'pendente');

  // =========================================================================
  // §26 — TESTE 14: EDITAR MAIS RECENTE
  // =========================================================================
  assertE2eInspection(sameDayB);
  const baseSameDayB = (await inspA.from('inspecoes').select('updated_at').eq('id', sameDayB).maybeSingle()).data?.updated_at;
  await inspA.from('inspecoes')
    .update({ status: 'regular' })
    .eq('id', sameDayB).eq('updated_at', baseSameDayB)
    .select('id').maybeSingle();
  const rpcNew = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: null, p_trigger_inspection_id: null,
  });
  const eqNew = await admin.from('equipamentos').select('status').eq('id', TAG).maybeSingle();
  record('TESTE 14: Editar mais recente → equipamento regular', eqNew.data?.status === 'regular');

  // =========================================================================
  // §27 — TESTE 15: p_next_inspection_date
  // =========================================================================
  const nextDate = '2027-12-31';
  const rpcA = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: nextDate, p_trigger_inspection_id: sameDayB,
  });
  record('TESTE 15A: trigger vencedora → aplica próxima', rpcA.data?.data_proxima_inspecao === nextDate);

  const rpcB = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: '2028-01-01', p_trigger_inspection_id: sameDayA,
  });
  record('TESTE 15B: trigger antigo → NÃO altera', rpcB.data?.data_proxima_inspecao === nextDate);

  const rpcC = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_next_inspection_date: '2028-02-02', p_trigger_inspection_id: null,
  });
  record('TESTE 15C: trigger null → NÃO altera', rpcC.data?.data_proxima_inspecao === nextDate);

  const rpcBad = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: TAG, p_trigger_inspection_id: 'INSP-INEXISTENTE',
  });
  record('TESTE 15D: trigger inexistente → rejeitado', Boolean(rpcBad.error));

  const rpcNoEq = await admin.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: `${TAG}-NOPE`,
  });
  record('TESTE 15E: equipamento inexistente → NOEQPT', Boolean(rpcNoEq.error));

  // =========================================================================
  // §28 — TESTE 16: FOTO
  // =========================================================================
  const photoInsp = newInspectionId();
  assertE2eInspection(photoInsp);
  await inspA.from('inspecoes')
    .insert({ id: photoInsp, equipment_id: TAG, data: '2026-04-01', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('id').maybeSingle();

  const photoPath = `${uidA}/${photoInsp}/e2e-test.jpg`;
  createdTestStoragePaths.push(photoPath);
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const upload = await inspA.storage
    .from('inspection-photos')
    .upload(photoPath, new globalThis.Blob([bytes], { type: 'image/jpeg' }), { upsert: true, contentType: 'image/jpeg' });
  record('TESTE 16A: A faz upload no Storage', !upload.error, upload.error?.message ?? '');

  const photoId = newPhotoId();
  assertE2eInspection(photoInsp);
  const photoInsert = await inspA.from('fotos_inspecao').insert({
    id: photoId, inspection_id: photoInsp, storage_path: photoPath,
    mime_type: 'image/jpeg', size_bytes: bytes.length, created_by: uidA,
  }).select('id').maybeSingle();
  record('TESTE 16B: A registra metadata', !photoInsert.error, photoInsert.error?.message ?? '');

  const metaB = await inspB.from('fotos_inspecao').select('id').eq('inspection_id', photoInsp);
  record('TESTE 16C: B vê metadata da foto de A', !metaB.error && (metaB.data ?? []).length === 1);

  const dlB = await inspB.storage.from('inspection-photos').download(photoPath);
  record('TESTE 16D: B baixa foto (compartilhado)', !dlB.error, dlB.error?.message ?? '');

  const dlAnon = await anon.storage.from('inspection-photos').download(photoPath);
  record('TESTE 16E: Anônimo NEGADO no Storage', Boolean(dlAnon.error));

  const rlsAnon = await anon.from('inspecoes').select('id').eq('id', insp1);
  record('TESTE 16F: Anônimo não lê inspeções', (rlsAnon.data ?? []).length === 0);

  // =========================================================================
  // §29 — STORAGE PRIVADO
  // =========================================================================
  const bucketSql = execSync('supabase db query --linked "select public from storage.buckets where id = \'inspection-photos\'"', { encoding: 'utf8' });
  const bucketPrivate = bucketSql.includes('false');
  record('TESTE 29: Bucket inspection-photos continua privado', bucketPrivate);

  // =========================================================================
  // §31 — TESTE 17: PERFIL NÃO AUTORIZADO
  // =========================================================================
  if (unauthed && uidUnauthorized) {
    const rUnauthSel = await unauthed.from('inspecoes').select('id').eq('id', insp1);
    record('TESTE 17A: Não autorizado NÃO lê inspeção', (rUnauthSel.data ?? []).length === 0);
    const rUnauthUpd = await unauthed.from('inspecoes').update({ observacoes: 'hack' }).eq('id', insp1).select('id');
    record('TESTE 17B: Não autorizado NÃO edita inspeção', Boolean(rUnauthUpd.error) || (rUnauthUpd.data ?? []).length === 0);
    const rUnauthRpc = await unauthed.rpc('recalculate_equipment_from_latest_inspection', { p_equipment_id: TAG });
    record('TESTE 17C: Não autorizado NÃO executa RPC', Boolean(rUnauthRpc.error));
  } else {
    console.log('[SKIP] TESTE 17: sem TEST_UNAUTHORIZED_* configurado');
  }

  // =========================================================================
  // §32 — TESTE 18: ADMIN DELETE (SOMENTE E2E)
  // =========================================================================
  const delInspId = newInspectionId();
  assertE2eInspection(delInspId);
  await inspA.from('inspecoes')
    .insert({ id: delInspId, equipment_id: TAG, data: '2026-05-01', inspetor: 'Inspector A Test', status: 'regular', user_id: uidA })
    .select('id').maybeSingle();

  const delResult = await admin.from('inspecoes').delete().eq('id', delInspId).select('id');
  record('TESTE 18: Admin excluiu inspeção E2E', !delResult.error && (delResult.data ?? []).length === 1);
  createdTestInspectionIds.delete(delInspId);

  // =========================================================================
  // §33 — OFFLINE-FIRST (PENDENTE)
  // =========================================================================
  console.log('\n[PENDENTE DE TESTE MANUAL] §33 — Offline-first: B abre inspeção E2E, fica offline, edita, reconecta → CAS.');
  console.log('[PENDENTE DE TESTE MANUAL] §34 — UI duas sessões: A e B editam mesma inspeção E2E → banner conflito.\n');

  // =========================================================================
  // §40 — VERIFICAÇÃO FINAL DE INTEGRIDADE DOS EQUIPAMENTOS EXISTENTES
  // =========================================================================
  console.log('--- [SAFETY] Verificação final de integridade ---');
  const snapAfter = await admin.from('equipamentos')
    .select('id, qr_code, status, deleted_at, data_ultima_inspecao, data_proxima_inspecao, updated_at')
    .order('id');
  const afterMap = new Map((snapAfter.data ?? []).map((e) => [e.id, e]));
  let integrityIssues = 0;

  for (const orig of existingEquipmentSnapshot) {
    const now = afterMap.get(orig.id);
    if (!now) {
      console.error(`  [BLOCKED] Equipamento pré-existente ${orig.id} DESAPARECEU!`);
      integrityIssues++;
      continue;
    }
    const diffs = [];
    if (orig.qr_code !== now.qr_code) diffs.push('qr_code');
    if (orig.status !== now.status) diffs.push('status');
    if (orig.deleted_at !== now.deleted_at) diffs.push('deleted_at');
    if (orig.data_ultima_inspecao !== now.data_ultima_inspecao) diffs.push('data_ultima_inspecao');
    if (orig.data_proxima_inspecao !== now.data_proxima_inspecao) diffs.push('data_proxima_inspecao');
    if (orig.updated_at !== now.updated_at) diffs.push('updated_at');
    if (diffs.length) {
      console.error(`  [BLOCKED] Equipamento ${orig.id} alterado: ${diffs.join(', ')}`);
      integrityIssues++;
    }
  }

  const e2eStillExists = afterMap.has(TAG);
  const finalCount = snapAfter.data?.length ?? 0;
  const expectedCount = e2eStillExists
    ? existingEquipmentCountBefore + 1
    : existingEquipmentCountBefore;
  const countOk = finalCount === expectedCount;

  if (integrityIssues === 0) {
    console.log(`  [PASS] 100% dos equipamentos pré-existentes permanecem inalterados`);
  } else {
    console.error(`  [BLOCKED] ${integrityIssues} equipamento(s) pré-existente(s) alterado(s)`);
  }
  record('Equipamentos pré-existentes intactos', integrityIssues === 0);
  record(`Contagem: ${existingEquipmentCountBefore} → ${finalCount} (esperado ${expectedCount})`, countOk);

  // =========================================================================
  // §42 — VERIFICAÇÃO FINAL DOS QR CODES
  // =========================================================================
  let qrIssues = 0;
  for (const orig of existingEquipmentSnapshot) {
    const now = afterMap.get(orig.id);
    if (now && orig.qr_code !== now.qr_code) {
      console.error(`  [BLOCKED] QR de ${orig.id} alterado: "${orig.qr_code}" → "${now.qr_code}"`);
      qrIssues++;
    }
  }
  record('QR Codes pré-existentes intactos', qrIssues === 0);

  return finish();
}

// ─── CLEANUP (§38) ──────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n--- [CLEANUP] Removendo dados E2E ---');

  // 1. Storage (fotos)
  for (const path of createdTestStoragePaths) {
    const r = await admin.storage.from('inspection-photos').remove([path]);
    if (r.error) console.warn(`  aviso: remover storage ${path}: ${r.error.message}`);
    else console.log(`  storage removido: ${path}`);
  }

  // 2. Metadata de fotos (por ID exato)
  for (const photoId of createdTestPhotoIds) {
    const r = await admin.from('fotos_inspecao').delete().eq('id', photoId);
    if (r.error) console.warn(`  aviso: remover foto ${photoId}: ${r.error.message}`);
    else console.log(`  foto metadata removida: ${photoId}`);
  }

  // 3. Inspeções (por ID exato — §11)
  for (const inspId of createdTestInspectionIds) {
    const r = await admin.from('inspecoes').delete().eq('id', inspId);
    if (r.error) console.warn(`  aviso: remover inspeção ${inspId}: ${r.error.message}`);
    else console.log(`  inspeção removida: ${inspId}`);
  }

  // 4. Equipamento E2E (por ID exato — §36)
  for (const eqId of createdTestEquipmentIds) {
    assertE2eEquipment(eqId);
    const r = await admin.from('equipamentos').delete().eq('id', eqId);
    if (r.error) console.warn(`  aviso: remover equipamento ${eqId}: ${r.error.message}`);
    else console.log(`  equipamento removido: ${eqId}`);
  }

  console.log('  [CLEANUP] Concluído.');
}

async function finish() {
  try { await cleanup(); } catch (e) { console.error('  Erro no cleanup:', e.message); }

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== Resumo ===');
  console.log(`Total: ${results.length} · Passou: ${results.length - failed.length} · Falhou: ${failed.length}`);
  if (failed.length) {
    console.log('\nFalhas:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  }

  const blocked = failed.some((f) => f.name.includes('intactos') || f.name.includes('QR') || f.name.includes('Contagem'));
  if (blocked) {
    console.error('\n[BLOCKED] Dados pré-existentes foram alterados. Merge BLOQUEADO.');
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\n[ERRO FATAL]', err.message);
  try { await cleanup(); } catch { /* noop */ }
  process.exit(1);
});
