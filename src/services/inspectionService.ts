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
import type { Inspection } from '../types';
import type { FetchResult } from './equipmentService';

const isDev = import.meta.env.DEV;

export async function fetchInspections(): Promise<FetchResult<Inspection>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, data: null };
  }
  const { data, error } = await supabase
    .from('inspecoes')
    .select('*')
    .order('data', { ascending: false });
  if (error) {
    console.error('[inspection.fetch]', error);
    return { ok: false, data: null };
  }
  return { ok: true, data: (data as DbInspecao[]).map(dbToInspection) };
}

export async function upsertInspection(insp: Inspection): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[inspection.upsert] Supabase não configurado — ignorando.');
    return false;
  }
  const { error } = await supabase
    .from('inspecoes')
    .upsert({ ...inspectionToDb(insp), sincronizado: true } as DbInspecao, { onConflict: 'id' });
  if (error) {
    console.error('[inspection.upsert]', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Centralised inspection loader — Supabase is the primary source of truth.
// IndexedDB is only used as offline fallback.
// ---------------------------------------------------------------------------

export async function carregarInspecoes(): Promise<Inspection[]> {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

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
            await db.inspecoes.put({ ...insp, sincronizado: true });
          } else if (local.sincronizado && !local.pendingDelete) {
            await db.inspecoes.put({ ...insp, sincronizado: true });
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
