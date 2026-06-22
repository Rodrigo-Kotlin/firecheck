import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  dbToActionPlan,
  actionPlanToDb,
  stripActionPlanSyncMeta,
  type DbPlanoAcao,
} from './mappers';
import { db } from '../db';
import type { ActionPlan } from '../types';
import type { FetchResult, ServiceResult } from './equipmentService';

const isDev = import.meta.env.DEV;

export async function fetchActionPlans(): Promise<FetchResult<ActionPlan>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, data: null };
  }
  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[actionPlan.fetch]', error);
    return { ok: false, data: null };
  }
  return { ok: true, data: (data as DbPlanoAcao[]).map(dbToActionPlan) };
}

export async function createActionPlanRemote(plan: ActionPlan): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const payload = actionPlanToDb(plan);
  payload.created_at = new Date().toISOString();
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('planos_acao')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, code: 'duplicate', message: 'Já existe um plano de ação com este ID no servidor.' };
    }
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para criar plano de ação.' };
    }
    console.error('[actionPlan.create]', error);
    return { ok: false, code: 'unknown', message: error.message };
  }

  if (!data || !data.id) {
    return { ok: false, code: 'unknown', message: 'Nenhuma linha criada — erro inesperado.' };
  }

  return { ok: true };
}

export async function updateActionPlanRemote(plan: ActionPlan): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const payload = actionPlanToDb(plan);
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('planos_acao')
    .update(payload)
    .eq('id', plan.id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para atualizar plano de ação.' };
    }
    console.error('[actionPlan.update]', error);
    return { ok: false, code: 'unknown', message: error.message };
  }

  if (!data) {
    return { ok: false, code: 'not_found', message: 'Atualização não aplicada. Verifique permissão/RLS ou conflito de sincronização.' };
  }

  return { ok: true };
}

/** Fetch a single action plan by ID, returning a ServiceResult that
 *  distinguishes "not found" from network errors. */
export async function fetchActionPlanById(id: string): Promise<ServiceResult<ActionPlan>> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const { data, error } = await supabase
    .from('planos_acao')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[actionPlan.fetchById]', error);
    return { ok: false, code: 'network', message: error.message };
  }
  if (!data) {
    return { ok: false, code: 'not_found', message: 'Plano de ação não encontrado no servidor.' };
  }
  return { ok: true, data: dbToActionPlan(data as DbPlanoAcao) };
}

export async function softDeleteActionPlanRemote(id: string, userId?: string): Promise<ServiceResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, code: 'network', message: 'Supabase não configurado.' };
  }
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    deleted_at: now,
    updated_at: now,
  };
  if (userId) {
    update.deleted_by = userId;
  }

  const { data, error } = await supabase
    .from('planos_acao')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return { ok: false, code: 'permission_denied', message: 'Sem permissão para excluir plano de ação.' };
    }
    console.error('[actionPlan.softDelete]', error);
    return { ok: false, code: 'unknown', message: error.message };
  }

  if (!data) {
    return { ok: false, code: 'not_found', message: 'Plano de ação não encontrado para exclusão.' };
  }

  return { ok: true };
}

export async function carregarPlanosDeAcao(): Promise<ActionPlan[]> {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  if (isDev) {
    console.log(`[loader-planos] online=${isOnline}, supabase=${isSupabaseConfigured}`);
  }

  if (isOnline && isSupabaseConfigured && supabase) {
    const result = await fetchActionPlans();

    if (result.ok && result.data) {
      const cloudData = result.data;
      if (cloudData.length > 0) {
        for (const plan of cloudData) {
          const local = await db.planosAcao.get(plan.id);
          if (!local) {
            await db.planosAcao.put({ ...plan, sincronizado: true });
          } else if (local.sincronizado && !local.pendingDelete) {
            await db.planosAcao.put({ ...plan, sincronizado: true });
          }
        }
        if (isDev) console.log(`[loader-planos] ${cloudData.length} planos mesclados do Supabase`);
      } else {
        if (isDev) console.log('[loader-planos] Supabase vazio — preservando dados locais');
      }

      const local = await db.planosAcao
        .filter((p) => !p.pendingDelete && !p.deletedAt)
        .toArray();
      return local.map(stripActionPlanSyncMeta);
    }

    if (isDev) console.warn('[loader-planos] falha ao buscar do Supabase — tentando cache local');
  }

  const local = await db.planosAcao
    .filter((p) => !p.pendingDelete && !p.deletedAt)
    .toArray();

  if (isDev) {
    console.log(`[loader-planos] ${local.length} planos carregados do IndexedDB (offline)`);
  }

  return local.map(stripActionPlanSyncMeta);
}

export async function limparPlanosLocais(): Promise<void> {
  await db.planosAcao.clear();
  if (isDev) console.log('[cleanup-planos] planos locais limpos');
}
