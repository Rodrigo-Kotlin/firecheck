/**
 * Action plan service — Supabase CRUD.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  dbToActionPlan,
  actionPlanToDb,
  type DbPlanoAcao,
} from './mappers';
import type { ActionPlan } from '../types';

export async function fetchActionPlans(): Promise<ActionPlan[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[actionPlan.fetch] Supabase não configurado — ignorando.');
    return null;
  }
  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[actionPlan.fetch]', error);
    return null;
  }
  return (data as DbPlanoAcao[]).map(dbToActionPlan);
}

export async function upsertActionPlan(plan: ActionPlan): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[actionPlan.upsert] Supabase não configurado — ignorando.');
    return false;
  }
  const { error } = await supabase
    .from('planos_acao')
    .upsert(actionPlanToDb(plan) as DbPlanoAcao, { onConflict: 'id' });
  if (error) {
    console.error('[actionPlan.upsert]', error);
    return false;
  }
  return true;
}

export async function deleteActionPlan(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[actionPlan.delete] Supabase não configurado — ignorando.');
    return false;
  }
  const { error } = await supabase.from('planos_acao').delete().eq('id', id);
  if (error) {
    console.error('[actionPlan.delete]', error);
    return false;
  }
  return true;
}
