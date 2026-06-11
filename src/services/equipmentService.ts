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
import type { Equipment } from '../types';

function notConfigured<T>(op: string): T | null {
  console.warn(`[equipment.${op}] Supabase não configurado — ignorando.`);
  return null;
}

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
