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

const isDev = import.meta.env.DEV;

export async function fetchInspections(): Promise<Inspection[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[inspection.fetch] Supabase não configurado — ignorando.');
    return null;
  }
  const { data, error } = await supabase
    .from('inspecoes')
    .select('*')
    .order('data', { ascending: false });
  if (error) {
    console.error('[inspection.fetch]', error);
    return null;
  }
  return (data as DbInspecao[]).map(dbToInspection);
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
    const cloudData = await fetchInspections();

    if (cloudData !== null) {
      if (cloudData.length > 0) {
        await db.inspecoes.clear();
        for (const insp of cloudData) {
          await db.inspecoes.put({ ...insp, sincronizado: true });
        }
        if (isDev) console.log(`[loader-inspecoes] ${cloudData.length} inspeções carregadas do Supabase`);
        return cloudData;
      }

      await limparInspecoesLocais();
      if (isDev) console.log('[loader-inspecoes] Supabase vazio — cache local limpo');
      return [];
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
