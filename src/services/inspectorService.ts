/**
 * Inspector service — Supabase fetch.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dbToInspector, type DbInspetor } from './mappers';
import type { Inspector } from '../types';

export async function fetchInspectors(): Promise<Inspector[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[inspector.fetch] Supabase não configurado — ignorando.');
    return null;
  }
  const { data, error } = await supabase
    .from('inspetores')
    .select('*')
    .order('nome');
  if (error) {
    console.error('[inspector.fetch]', error);
    return null;
  }
  return (data as DbInspetor[]).map(dbToInspector);
}
