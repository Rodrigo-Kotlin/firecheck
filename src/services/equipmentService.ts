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
import { db } from '../db';
import type { Equipment } from '../types';

const isDev = import.meta.env.DEV;

function notConfigured<T>(op: string): T | null {
  console.warn(`[equipment.${op}] Supabase não configurado — ignorando.`);
  return null;
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

export async function upsertEquipment(eq: Equipment): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    notConfigured<boolean>('upsertEquipment');
    return false;
  }
  const payload = equipmentToDb(eq);
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
        await db.equipamentos.clear();
        for (const eq of cloudData) {
          await db.equipamentos.put({ ...eq, sincronizado: true });
        }
        if (isDev) console.log(`[loader] ${cloudData.length} equipamentos carregados do Supabase`);
        return cloudData;
      }

      await limparEquipamentosLocais();
      if (isDev) console.log('[loader] Supabase vazio — cache local limpo');
      return [];
    }

    if (isDev) console.warn('[loader] falha ao buscar do Supabase — tentando cache local');
  }

  // Offline / fallback: load from IndexedDB
  const localEqs = await db.equipamentos
    .filter((e) => !e.pendingDelete)
    .toArray();

  if (isDev) {
    console.log(`[loader] ${localEqs.length} equipamentos carregados do IndexedDB (offline)`);
  }

  return localEqs.map(stripSyncMeta);
}

/** Strip Dexie-only sync metadata from an equipment row. */
function stripSyncMeta(row: { sincronizado: boolean; pendingDelete?: boolean } & Equipment): Equipment {
  const { sincronizado: _s, pendingDelete: _p, ...eq } = row;
  void _s; void _p;
  return eq;
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


