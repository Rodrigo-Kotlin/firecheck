/**
 * Inspection service — Supabase CRUD.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  dbToInspection,
  inspectionToDb,
  type DbInspecao,
} from './mappers';
import type { Inspection } from '../types';

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
