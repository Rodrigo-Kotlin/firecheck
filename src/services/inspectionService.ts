/**
 * Inspection service — Supabase CRUD.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  dbToInspection,
  inspectionToDb,
  type DbInspecao,
} from './mappers';
import { db } from '../db';
import type { Equipment, Inspection } from '../types';
import type { FetchResult, ServiceResult } from './equipmentService';
import { isNetworkUnavailableError } from '../utils/network';
import { canAttemptNetwork } from './networkState';
import { fetchAllPages } from './pagination';

const isDev = import.meta.env.DEV;

export async function fetchInspections(): Promise<FetchResult<Inspection>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, data: null, complete: false, network: false };
  }
  const result = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase!
      .from('inspecoes')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);
    return { data: data as DbInspecao[] | null, error };
  });
  if (result.error) {
    const network = isNetworkUnavailableError(result.error);
    console.error('[inspection.fetch]', network ? '(rede)' : '', result.error);
    return { ok: false, data: result.rows.map(dbToInspection), complete: false, network };
  }
  return { ok: true, data: result.rows.map(dbToInspection), complete: result.complete, network: false };
}

/** Fetch a single inspection by ID (mapped model). */
export async function fetchInspectionById(id: string): Promise<ServiceResult<Inspection>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.', network: false };
  }
  const { data, error } = await supabase
    .from('inspecoes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    const network = isNetworkUnavailableError(error);
    console.error('[inspection.fetchById]', network ? '(rede)' : '', error);
    return { ok: false, code: network ? 'network' : 'unknown', message: error.message, network };
  }
  if (!data) {
    return { ok: false, code: 'not_found', message: 'Inspeção não encontrada no servidor.', network: false };
  }
  return { ok: true, data: dbToInspection(data as DbInspecao) };
}

/** Fetch a single inspection row (raw DB shape) — used for CAS diagnostics.
 *  Never throws: network failures are reported via `error`. */
async function fetchInspectionRowById(
  id: string,
): Promise<{ found: boolean; row?: DbInspecao; error?: string; network?: boolean }> {
  if (!isSupabaseConfigured || !supabase) return { found: false, error: 'Supabase não configurado.', network: false };
  const { data, error } = await supabase
    .from('inspecoes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    const network = isNetworkUnavailableError(error);
    console.error('[inspection.fetchRowById]', network ? '(rede)' : '', error);
    return { found: false, error: error.message, network };
  }
  if (!data) return { found: false };
  return { found: true, row: data as DbInspecao };
}

/** Create (or idempotently re-create) an inspection. Returns the persisted row
 *  so the caller can record the remote `updated_at` as the CAS base. */
export async function upsertInspection(
  insp: Inspection,
): Promise<{ ok: boolean; row?: DbInspecao; message?: string; network?: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[inspection.upsert] Supabase não configurado — ignorando.');
    return { ok: false, message: 'Supabase não configurado.', network: false };
  }

  const { data, error } = await supabase
    .from('inspecoes')
    .upsert({ ...inspectionToDb(insp), sincronizado: true } as DbInspecao, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return { ok: false, message: 'Sem permissão para salvar a inspeção no servidor.', network: false };
    }
    const network = isNetworkUnavailableError(error);
    console.error('[inspection.upsert]', network ? '(rede)' : '', error);
    return { ok: false, message: error.message, network };
  }

  if (!data) {
    return { ok: false, message: 'Nenhuma linha confirmada pelo servidor — tentaremos novamente.' };
  }

  return { ok: true, row: data as DbInspecao };
}

// ---------------------------------------------------------------------------
// Update com CAS (compare-and-set) — edição compartilhada offline-first.
// ---------------------------------------------------------------------------

export interface UpdateInspectionRemoteInput {
  id: string;
  data: string;
  status: Equipment['status'];
  observacoes?: string;
  /** Nome operacional de quem está editando (obrigatório na UI). */
  updatedByName?: string;
  /** updated_at remoto conhecido na última sincronização. Quando ausente
   *  (registro legado), a base é obtida por um fetch imediatamente antes do
   *  UPDATE — NUNCA fazemos UPDATE sem CAS. */
  syncBaseUpdatedAt?: string | null;
}

export type InspectionUpdateResult =
  | { ok: true; row: DbInspecao }
  | {
      ok: false;
      code:
        | 'conflict'
        | 'not_found'
        | 'permission_denied'
        | 'not_authenticated'
        | 'invalid_status'
        | 'network'
        | 'unknown';
      message: string;
      /** Estado remoto atual (quando conhecido) — usado para orientar a revisão. */
      current?: Inspection | null;
      /** Comprovado que o backend está inalcançável (erro real de rede). */
      network?: boolean;
    };

/** Update an inspection with optimistic concurrency control (CAS).
 *
 *  O UPDATE é SEMPRE condicionado ao `updated_at` remoto
 *  (`WHERE id = ? AND updated_at = base`). Nunca existe "blind update":
 *  - base conhecida (`syncBaseUpdatedAt`) → CAS direto;
 *  - base ausente (registro legado) → fetch do remoto, adota
 *    `remote.updated_at` como base e então executa o CAS. Se o remoto mudar
 *    entre o fetch e o UPDATE, o CAS retorna zero linhas → conflito.
 *
 *  CAS negado é reportado como `conflict` (remoto mudou) ou `not_found`
 *  (remoto excluído), com `current` preenchido por um fetch. */
export async function updateInspectionRemote(
  input: UpdateInspectionRemoteInput,
): Promise<InspectionUpdateResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.', network: false };
  }

  // 1. Resolver a base do CAS — nunca UPDATE sem base.
  let base =
    typeof input.syncBaseUpdatedAt === 'string' && input.syncBaseUpdatedAt.length > 0
      ? input.syncBaseUpdatedAt
      : null;

  if (!base) {
    const remote = await fetchInspectionRowById(input.id);
    if (remote.error) {
      return { ok: false, code: remote.network ? 'network' : 'unknown', message: remote.error, network: remote.network ?? false };
    }
    if (!remote.found || !remote.row) {
      return {
        ok: false,
        code: 'not_found',
        message: 'Esta inspeção foi excluída no servidor.',
        current: null,
      };
    }
    base = remote.row.updated_at ?? null;
    if (!base) {
      return {
        ok: false,
        code: 'network',
        message: 'Servidor não retornou a versão da inspeção — tente novamente.',
        network: false,
      };
    }
  }

  const payload: Record<string, unknown> = {
    data: input.data,
    status: input.status,
    observacoes: input.observacoes ?? null,
  };
  if (input.updatedByName) payload.updated_by_name = input.updatedByName;

  // 2. CAS obrigatório — base exata (microssegundos preservados, sem Date).
  const { data, error } = await supabase
    .from('inspecoes')
    .update(payload)
    .eq('id', input.id)
    .eq('updated_at', base)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para editar esta inspeção.', network: false };
    }
    if (error.code === '23514' || error.code === '22007' || error.code === '22P02') {
      return { ok: false, code: 'invalid_status', message: 'Dados inválidos para esta inspeção.', network: false };
    }
    const network = isNetworkUnavailableError(error);
    console.error('[inspection.updateRemote]', network ? '(rede)' : '', error);
    return { ok: false, code: network ? 'network' : 'unknown', message: error.message, network };
  }

  if (data) {
    return { ok: true, row: data as DbInspecao };
  }

  // 3. Nenhuma linha: o CAS falhou. Distingue conflito de exclusão/existência.
  const remote = await fetchInspectionRowById(input.id);
  if (remote.error) {
    return { ok: false, code: remote.network ? 'network' : 'unknown', message: remote.error, network: remote.network ?? false };
  }
  if (!remote.found || !remote.row) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Esta inspeção foi excluída no servidor.',
      current: null,
    };
  }
  return {
    ok: false,
    code: 'conflict',
    message: 'Esta inspeção foi alterada em outro dispositivo após a última sincronização.',
    current: dbToInspection(remote.row),
  };
}

// ---------------------------------------------------------------------------
// Recálculo do status do equipamento a partir da inspeção mais recente.
// ---------------------------------------------------------------------------

/** Invoke the safe recalc RPC. Returns the applied equipment fields on success. */
export async function recalculateEquipmentFromLatestInspectionRemote(
  equipmentId: string,
  nextInspectionDate?: string,
  triggerInspectionId?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.', network: false };
  }

  const { data, error } = await supabase.rpc('recalculate_equipment_from_latest_inspection', {
    p_equipment_id: equipmentId,
    p_next_inspection_date: nextInspectionDate ?? null,
    p_trigger_inspection_id: triggerInspectionId ?? null,
  });

  if (error) {
    if (error.code === 'UNAUTH') {
      return { ok: false, code: 'not_authenticated', message: 'Usuário não autenticado.' };
    }
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para atualizar o status do equipamento.' };
    }
    const network = isNetworkUnavailableError(error);
    console.error('[inspection.recalculateEquipment]', network ? '(rede)' : '', error);
    return { ok: false, code: network ? 'network' : 'rpc_error', message: error.message ?? 'Falha ao recalcular o status do equipamento.', network };
  }

  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Centralised inspection loader — Supabase is the primary source of truth.
// IndexedDB is only used as offline fallback.
// ---------------------------------------------------------------------------

export async function carregarInspecoes(): Promise<Inspection[]> {
  const isOnline = canAttemptNetwork();

  if (isDev) {
    console.log(`[loader-inspecoes] online=${isOnline}, supabase=${isSupabaseConfigured}`);
  }

  if (isOnline && isSupabaseConfigured && supabase) {
    const result = await fetchInspections();

    if (result.ok && result.data) {
      const cloudData = result.data;
      if (cloudData.length > 0) {
        // Merge: import cloud rows without overwriting local pending data
        for (const insp of cloudData) {
          const local = await db.inspecoes.get(insp.id);
          if (!local) {
            await db.inspecoes.put({
              ...insp,
              sincronizado: true,
              syncBaseUpdatedAt: insp.updatedAt ?? null,
            });
          } else if (local.sincronizado && !local.pendingDelete) {
            await db.inspecoes.put({
              ...insp,
              sincronizado: true,
              syncBaseUpdatedAt: insp.updatedAt ?? null,
            });
          }
          // else: preserve local pending changes
        }
        if (isDev) console.log(`[loader-inspecoes] ${cloudData.length} inspeções mescladas do Supabase`);
      } else {
        if (isDev) console.log('[loader-inspecoes] Supabase vazio — preservando dados locais');
      }

      // Return merged data: local + cloud (local pending preserved)
      const local = await db.inspecoes
        .filter((i) => !i.pendingDelete)
        .toArray();
      return local.map(stripSyncMeta);
    }

    if (isDev) console.warn('[loader-inspecoes] falha ao buscar do Supabase — tentando cache local');
  }

  const local = await db.inspecoes
    .filter((i) => !i.pendingDelete)
    .toArray();

  if (isDev) {
    console.log(`[loader-inspecoes] ${local.length} inspeções carregadas do IndexedDB (offline)`);
  }

  return local.map(stripSyncMeta);
}

function stripSyncMeta(row: { sincronizado: boolean; pendingDelete?: boolean } & Inspection): Inspection {
  const { sincronizado: _s, pendingDelete: _p, ...rest } = row;
  void _s; void _p;
  return rest;
}

export async function limparInspecoesLocais(): Promise<void> {
  await db.inspecoes.clear();
  if (isDev) console.log('[cleanup-inspecoes] inspeções locais limpas');
}
