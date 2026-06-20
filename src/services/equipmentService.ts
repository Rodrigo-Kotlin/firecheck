/**
 * Equipment service — Supabase CRUD.
 * Returns `null` and logs a warning when the client is not configured, so the
 * rest of the app can keep running on local data only.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  dbToEquipment,
  equipmentToDb,
  type DbEquipamento,
} from './mappers';
import { db, type LocalEquipment } from '../db';
import type { Equipment } from '../types';

const isDev = import.meta.env.DEV;

function notConfigured<T>(op: string): T | null {
  console.warn(`[equipment.${op}] Supabase não configurado — ignorando.`);
  return null;
}

// ---------------------------------------------------------------------------
// Tipos compartilhados
// ---------------------------------------------------------------------------

export interface ServiceResult {
  ok: boolean;
  code?: 'duplicate' | 'permission_denied' | 'not_found' | 'network' | 'unknown' | 'not_applied' | 'invalid_status' | 'not_authenticated' | 'rpc_error';
  message?: string;
  data?: Equipment;
}

// ---------------------------------------------------------------------------
// Supabase CRUD
// ---------------------------------------------------------------------------

export async function fetchEquipments(): Promise<Equipment[] | null> {
  if (!isSupabaseConfigured || !supabase) return notConfigured('fetchEquipments');
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .order('id');
  if (error) {
    console.error('[equipment.fetchEquipments]', error);
    return null;
  }
  return (data as DbEquipamento[]).map(dbToEquipment);
}

export async function findEquipmentById(id: string): Promise<Equipment | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[equipment.findEquipmentById]', error);
    return null;
  }
  if (!data) return null;
  return dbToEquipment(data as DbEquipamento);
}

export async function createEquipmentRemote(eq: Equipment): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const payload = equipmentToDb(eq);
  payload.created_at = new Date().toISOString();
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('equipamentos')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, code: 'duplicate', message: 'Já existe um equipamento com esta TAG no servidor.' };
    }
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para criar equipamento.' };
    }
    console.error('[equipment.createEquipmentRemote]', error);
    return { ok: false, code: 'unknown', message: error.message };
  }

  if (!data || !data.id) {
    return { ok: false, code: 'unknown', message: 'Nenhuma linha criada — erro inesperado.' };
  }

  return { ok: true };
}

export async function updateEquipmentRemote(eq: Equipment): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const payload = equipmentToDb(eq);
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('equipamentos')
    .update(payload)
    .eq('id', eq.id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para atualizar equipamento.' };
    }
    console.error('[equipment.updateEquipmentRemote]', error);
    return { ok: false, code: 'unknown', message: error.message };
  }

  if (!data) {
    return { ok: false, code: 'not_found', message: 'Atualização não aplicada. Verifique permissão/RLS ou conflito de sincronização.' };
  }

  return { ok: true };
}

/**
 * @deprecated Use createEquipmentRemote() para criação e updateEquipmentRemote() para edição.
 * upsertEquipment permanece apenas para compatibilidade com código legado.
 */
export async function upsertEquipment(eq: Equipment): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    notConfigured<boolean>('upsertEquipment');
    return false;
  }
  const payload = equipmentToDb(eq);
  payload.updated_at = new Date().toISOString();
  if (!payload.created_at) {
    payload.created_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('equipamentos')
    .upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('[equipment.upsertEquipment]', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload,
    });
    return false;
  }
  return true;
}

export async function deleteEquipment(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    notConfigured<boolean>('deleteEquipment');
    return false;
  }
  const { error } = await supabase.from('equipamentos').delete().eq('id', id);
  if (error) {
    console.error('[equipment.deleteEquipment] Falha ao excluir equipamento', {
      id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }
  return true;
}

/** Soft-delete: sets deleted_at and keeps the tombstone in Supabase
 *  so other clients can discover the deletion during pull. */
export async function softDeleteEquipment(id: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    notConfigured<boolean>('softDeleteEquipment');
    return false;
  }
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    deleted_at: now,
    updated_at: now,
  };
  if (userId) {
    update.deleted_by = userId;
  }
  const { error } = await supabase
    .from('equipamentos')
    .update(update)
    .eq('id', id);
  if (error) {
    console.error('[equipment.softDeleteEquipment] Falha ao marcar deleted_at', {
      id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }
  console.log('[equipment] Equipamento %s marcado como deleted_at=%s', id, now);
  return true;
}

export async function applyEquipmentInspectionStatusRemote(
  equipmentId: string,
  status: string,
  inspectionDate?: string,
  nextInspectionDate?: string,
): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }

  const { data, error } = await supabase.rpc('apply_equipment_inspection_status', {
    p_equipment_id: equipmentId,
    p_status: status,
    p_inspection_date: inspectionDate ?? null,
    p_next_inspection_date: nextInspectionDate ?? null,
  });

  if (error) {
    if (error.code === 'UNAUTH') {
      return { ok: false, code: 'not_authenticated', message: 'Usuário não autenticado.' };
    }
    if (error.code === 'INVSTT') {
      return { ok: false, code: 'invalid_status', message: 'Status inválido.' };
    }
    if (error.code === 'NFOUND') {
      return { ok: false, code: 'not_found', message: 'Equipamento não encontrado ou excluído.' };
    }
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para executar esta operação.' };
    }
    console.error('[equipment.applyEquipmentInspectionStatus]', error);
    return { ok: false, code: 'rpc_error', message: error.message ?? 'Não foi possível atualizar o status do equipamento no servidor.' };
  }

  if (!data) {
    return { ok: false, code: 'not_applied', message: 'Nenhuma alteração aplicada — equipamento não encontrado ou excluído.' };
  }

  if (isDev) {
    console.log('[equipment.applyEquipmentInspectionStatus] Status do equipamento %s atualizado para %s', equipmentId, status);
  }

  return { ok: true, data: data as unknown as Equipment };
}

// ---------------------------------------------------------------------------
// Centralised equipment loader — Supabase is the primary source of truth.
// IndexedDB is only used as offline fallback.
// ---------------------------------------------------------------------------

export async function carregarEquipamentos(): Promise<Equipment[]> {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  if (isDev) {
    console.log(`[loader] online=${isOnline}, supabase=${isSupabaseConfigured}`);
  }

  // Online path: fetch from Supabase
  if (isOnline && isSupabaseConfigured && supabase) {
    const cloudData = await fetchEquipments();

    if (cloudData !== null) {
      if (cloudData.length > 0) {
        // Merge: import cloud rows without overwriting local pending data
        for (const eq of cloudData) {
          const local = await db.equipamentos.get(eq.id);
          if (!local) {
            await db.equipamentos.put({ ...eq, sincronizado: true });
          } else if (local.sincronizado && !local.pendingDelete) {
            await db.equipamentos.put({ ...eq, sincronizado: true });
          }
          // else: preserve local pending changes
        }
        if (isDev) console.log(`[loader] ${cloudData.length} equipamentos mesclados do Supabase`);
      } else {
        if (isDev) console.log('[loader] Supabase vazio — preservando dados locais');
      }

      // Return merged data (exclude pending deletes and remote tombstones)
      const localEqs = await db.equipamentos
        .filter((e) => !e.pendingDelete && !e.deletedAt)
        .toArray();
      return localEqs.map(stripSyncMeta);
    }

    if (isDev) console.warn('[loader] falha ao buscar do Supabase — tentando cache local');
  }

  // Offline / fallback: load from IndexedDB
  const localEqs = await db.equipamentos
    .filter((e) => !e.pendingDelete && !e.deletedAt)
    .toArray();

  if (isDev) {
    console.log(`[loader] ${localEqs.length} equipamentos carregados do IndexedDB (offline)`);
  }

  return localEqs.map(stripSyncMeta);
}

/** Strip Dexie-only sync metadata from an equipment row. */
function stripSyncMeta(row: Partial<LocalEquipment>): Equipment {
  const { sincronizado: _s, pendingDelete: _p, deletedAt: _d, deletedBy: _db, createdAt: _c, updatedAt: _u, ...eq } = row;
  void _s; void _p; void _d; void _db; void _c; void _u;
  return eq as Equipment;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

export async function limparEquipamentosLocais(): Promise<void> {
  await db.equipamentos.clear();
  if (isDev) console.log('[cleanup] equipamentos locais limpos');
}

export async function limparInspecoesLocais(): Promise<void> {
  await db.inspecoes.clear();
  if (isDev) console.log('[cleanup] inspeções locais limpas');
}

export async function limparFotosLocais(): Promise<void> {
  await db.fotos.clear();
  if (isDev) console.log('[cleanup] fotos locais limpas');
}

export async function limparAcoesPendentes(): Promise<void> {
  await db.acoes_pendentes.clear();
  if (isDev) console.log('[cleanup] ações pendentes limpas');
}

export async function limparCacheLocalDoApp(): Promise<void> {
  await db.clearCache();
  if (isDev) console.log('[cleanup] cache local do app completamente limpo');
}


