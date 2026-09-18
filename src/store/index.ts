import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Equipment, Inspection, Inspector, Stats, ActionPlan, ActionPlanStatus, AppConfig, EquipmentStatus } from '../types';
import { db, type LocalEquipment, type LocalInspection, type LocalActionPlan, type LocalInspectionPhoto } from '../db';
import { syncAll, pendingSyncCount, conflictCount } from '../services/sync';
import { carregarEquipamentos, limparCacheLocalDoApp, createEquipmentRemote, updateEquipmentRemote, fetchEquipmentById } from '../services/equipmentService';
import { carregarInspecoes, fetchInspectionById, updateInspectionRemote, recalculateEquipmentFromLatestInspectionRemote } from '../services/inspectionService';
import { carregarPlanosDeAcao, fetchActionPlanById, updateActionPlanRemote } from '../services/actionPlanService';
import { stripActionPlanSyncMeta } from '../services/mappers';
import { canViewInspection, canEditInspection, canDeleteInspection } from '../services/permissions';
import { getLatestInspectionForEquipment } from '../utils/equipmentFilters';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { canAttemptNetwork, ensureNetworkListeners } from '../services/networkState';
import {
  loginUser,
  registerUser,
  resolveSession,
  logoutUser,
  listUsers,
  deleteUser,
  setUserRole,
  type PublicUser,
  type AuthError,
} from '../services/authService';

export type Tab = 'dashboard' | 'equipamentos' | 'qrcodes' | 'inspecionar' | 'relatorios';

export interface EquipmentResult {
  ok: boolean;
  mode: 'local' | 'cloud';
  message?: string;
}

/** Foto já comprimida (Blob) a ser anexada a uma inspeção. */
export interface InspectionPhotoInput {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

/** Resultado granular do salvamento da inspeção (+ foto). A inspeção e a foto
 *  são persistidas atomicamente no IndexedDB — nenhum sucesso é reportado
 *  antes de ambas serem gravadas. */
export interface SaveInspectionResult {
  ok: boolean;
  /** Instrui se a inspeção foi persistida (com ou sem foto). */
  inspectionSaved: boolean;
  /** false quando a foto falhou (ex.: quota do IndexedDB). */
  photoSaved: boolean;
  error?: string;
  /** ID determinístico da tentativa que originou esta inspeção. */
  inspectionId?: string;
  /** true quando a tentativa já existia localmente e o submit foi absorvido
   *  (retry / double-submit) — NENHUM registro duplicado foi criado. */
  idempotent?: boolean;
  /** true quando, no caminho idempotente, o plano de ação derivado
   *  (`PAC-<inspectionId>`) estava ausente e foi recriado de forma controlada
   *  — sem nova inspeção e sem sobrescrever plano existente. */
  repairedActionPlan?: boolean;
}

/** Resultado da edição compartilhada de uma inspeção. */
export interface InspectionSaveResult {
  ok: boolean;
  mode: 'local' | 'cloud';
  /** true quando a alteração local conflitou com uma versão remota mais nova. */
  conflict?: boolean;
  message?: string;
}

function inferCriticidade(inspectionObs: string, eqTipo: string): import('../types').Criticidade {
  const obs = inspectionObs.toLowerCase();
  const tipo = eqTipo.toLowerCase();
  if (
    obs.includes('sem carga') || obs.includes('sem lacre') || obs.includes('sem acesso') ||
    obs.includes('sem mangueira') || obs.includes('inoperante') ||
    (tipo.includes('extintor') && obs.includes('vencido'))
  ) return 'Crítico';
  if (obs.includes('sinalização') || obs.includes('mangueira') || obs.includes('abrigo')) return 'Alto';
  if (obs.includes('etiqueta') || obs.includes('sujeira') || obs.includes('avaria')) return 'Médio';
  return 'Baixo';
}

const MIGRATION_FLAG = 'firecheck_action_plans_migrated_to_dexie';

/** Migrate action plans from persisted Zustand/localStorage to Dexie.
 *  Runs once on first load after this code ships. */
async function migratePersistedActionPlansToDexie(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') return;

  try {
    const raw = localStorage.getItem('firecheck-storage');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const plans: ActionPlan[] = parsed?.state?.actionPlans ?? [];
    const meta: Record<string, { sincronizado: boolean; pendingDelete: boolean }> =
      parsed?.state?.actionPlanMeta ?? {};

    if (!Array.isArray(plans) || plans.length === 0) return;

    for (const plan of plans) {
      const exists = await db.planosAcao.get(plan.id);
      if (exists) continue;

      const m = meta[plan.id];
      await db.planosAcao.put({
        ...plan,
        sincronizado: m?.sincronizado ?? true,
        pendingDelete: m?.pendingDelete ?? false,
        syncAction: undefined,
        syncError: undefined,
        deletedAt: undefined,
        updatedAt: undefined,
      });
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
    if (import.meta.env.DEV) {
      console.log(`[store.migration] ${plans.length} planos migrados do localStorage para Dexie`);
    }
  } catch (err) {
    console.error('[store.migration] Erro ao migrar planos:', err);
  }
}

function recomputeStats(eqs: Equipment[]): Stats {
  const total = eqs.length;
  const emDia = eqs.filter((e) => e.status === 'regular').length;
  const pendentes = eqs.filter((e) => e.status === 'pendente').length;
  const vencidos = eqs.filter((e) => e.status === 'vencido' || e.status === 'extraviado').length;
  const observacao = eqs.filter((e) => e.status === 'observacao' || e.status === 'em_manutencao' || e.status === 'inativo' || e.status === 'substituido').length;
  const conformidade = total === 0 ? 0 : Math.round(((emDia + observacao) / total) * 100);
  return { total, emDia, pendentes, vencidos, conformidade };
}



interface AppState {
  user: Inspector | null;
  /** True after the first auth resolution has run (session check + orphan cleanup). */
  authReady: boolean;
  /** True while a login/register request is in flight. */
  authLoading: boolean;
  equipments: Equipment[];
  inspections: Inspection[];
  stats: Stats;
  actionPlans: ActionPlan[];
  config: AppConfig;
  currentTab: Tab;

  /** Cached public-user list, refreshed via `loadUsers`. Admin-only screen. */
  users: PublicUser[];
  usersLoading: boolean;

  /** Cloud sync telemetry. */
  syncing: boolean;
  pending: number;
  lastSyncAt: number | null;
  syncEnabled: boolean;
  /** Circuit breaker aberto (backend inalcançável ou browser offline). */
  networkUnavailable: boolean;

  /** Number of records in conflict (per entity type). */
  conflictCounts: { equipments: number; actionPlans: number; inspections: number };

  // ---- actions ----
  refreshConflictCount: () => Promise<void>;
  resolveEquipmentConflictKeepLocal: (id: string) => Promise<void>;
  resolveEquipmentConflictUseRemote: (id: string) => Promise<void>;
  resolveActionPlanConflictKeepLocal: (id: string) => Promise<void>;
  resolveActionPlanConflictUseRemote: (id: string) => Promise<void>;
  resolveInspectionConflictKeepLocal: (id: string) => Promise<void>;
  resolveInspectionConflictUseRemote: (id: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (input: { email: string; password: string; nome: string; cargo: string }) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentTab: (tab: Tab) => void;
  addInspection: (data: {
    /** ID DETERMINÍSTICO da tentativa de criação — gerado UMA vez no
     *  frontend e reutilizado em retries da mesma tentativa. O store NUNCA
     *  gera outro ID silenciosamente. */
    inspectionId: string;
    equipmentId: string;
    data: string;
    inspetor: string;
    status: EquipmentStatus;
    observacoes?: string;
    userId?: string;
    /** Foto comprimida (Blob) a anexar — opcional. */
    photo?: InspectionPhotoInput | null;
    dataProximaInspecao?: string;
  }) => Promise<SaveInspectionResult>;
  addEquipment: (eq: Equipment) => Promise<EquipmentResult>;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<EquipmentResult>;
  updateInspection: (
    id: string,
    updates: { data?: string; status: EquipmentStatus; observacoes?: string; updatedByName: string },
  ) => Promise<InspectionSaveResult>;
  addActionPlan: (plan: Omit<ActionPlan, 'id' | 'createdAt' | 'status'> & { status?: ActionPlanStatus }) => void;
  updateActionPlan: (id: string, updates: Partial<ActionPlan>) => void;
  deleteActionPlan: (id: string) => void;
  deleteEquipment: (id: string) => void;
  deleteInspection: (id: string) => Promise<void>;
  updateConfig: (updates: Partial<AppConfig>) => void;
  loadUsers: () => Promise<void>;
  setUserRole: (id: string, role: 'admin' | 'inspector') => Promise<void>;
  deleteUserAccount: (id: string) => Promise<void>;
  hydrate: () => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  clearLocalData: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /**
       * Helper: kick off a background sync attempt and update telemetry.
       * Never throws — failures are reflected in `lastSync.errors`.
       * Guards against concurrent sync via the sync module's flag.
       */
      const loadPlansFromDexie = async (): Promise<ActionPlan[]> => {
        const rows = await db.planosAcao
          .filter((p) => !p.pendingDelete && !p.deletedAt)
          .toArray();
        return rows.map(({
          sincronizado: _s, pendingDelete: _p, syncAction: _a, ...rest
        }) => {
          void _s; void _p; void _a;
          return rest as ActionPlan;
        });
      };

      const runSync = async (): Promise<void> => {
        if (!isSupabaseConfigured) return;
        if (!canAttemptNetwork()) {
          await get().refreshPendingCount();
          return;
        }
        set({ syncing: true, networkUnavailable: false });
        try {
          const report = await syncAll({ userId: get().user?.id });

          if (report.networkUnavailable) {
            set({ networkUnavailable: true });
            await get().refreshPendingCount();
            return;
          }

          if (!report.skipped) {
            // Reload equipments, inspections, and action plans from Dexie
            const [dbEqs, dbInsps, dbPlans] = await Promise.all([
              db.equipamentos.toArray(),
              db.inspecoes.toArray(),
              loadPlansFromDexie(),
            ]);

            const freshEqs: Equipment[] = [];
            for (const e of dbEqs) {
              if (e.pendingDelete || e.deletedAt) continue;
              const {
                sincronizado: _s, pendingDelete: _p,
                syncAction: _sa, statusUpdatePending: _su,
                ...clean
              } = e;
              void _s; void _p; void _sa; void _su;
              freshEqs.push(clean as unknown as Equipment);
            }

            const freshInsps: Inspection[] = [];
            for (const i of dbInsps) {
              if (i.pendingDelete) continue;
              const { sincronizado: _s2, pendingDelete: _p2, ...clean } = i;
              void _s2; void _p2;
              freshInsps.push(clean as unknown as Inspection);
            }

            set({
              equipments: freshEqs,
              inspections: freshInsps,
              actionPlans: dbPlans,
              stats: recomputeStats(freshEqs),
            });
          }

          set({ lastSyncAt: Date.now() });
          await get().refreshPendingCount();
          await get().refreshConflictCount();
        } catch (err) {
          console.error('[store.sync]', err);
        } finally {
          set({ syncing: false });
        }
      };

      return {
        user: null,
        authReady: false,
        authLoading: false,
        equipments: [],
        inspections: [],
        stats: { total: 0, emDia: 0, pendentes: 0, vencidos: 0, conformidade: 0 },
        actionPlans: [],
        config: {
          empresa: 'FireCheck Corp',
          unidade: 'Sede São Paulo',
          offlineMode: false,
          notificationsEnabled: true,
        },
        currentTab: 'dashboard',
        users: [],
        usersLoading: false,
        syncing: false,
        pending: 0,
        lastSyncAt: null,
        syncEnabled: isSupabaseConfigured,
        networkUnavailable: false,
        conflictCounts: { equipments: 0, actionPlans: 0, inspections: 0 },

        // -----------------------------------------------------------------
        // Auth — Supabase Auth + tabela `profiles`. A sessão é mantida pelo
        // próprio client Supabase em `localStorage['firecheck-auth']`. Aqui
        // só sincronizamos o `user: Inspector` derivado do perfil.
        // -----------------------------------------------------------------
        login: async (email, pass) => {
          set({ authLoading: true });
          try {
            const user = await loginUser({ email, password: pass });
            set({ user, authLoading: false });
            void runSync();
          } catch (err) {
            set({ authLoading: false });
            throw err as AuthError;
          }
        },
        register: async (input) => {
          set({ authLoading: true });
          try {
            const user = await registerUser(input);
            set({ user, authLoading: false });
          } catch (err) {
            set({ authLoading: false });
            throw err as AuthError;
          }
        },
        logout: async () => {
          await logoutUser();
          set({ user: null });
        },
        setCurrentTab: (tab) => set({ currentTab: tab }),
        updateConfig: (updates) =>
          set((state) => ({ config: { ...state.config, ...updates } })),

        // -----------------------------------------------------------------
        // Hydration: resolve auth session, then load equipment and inspection
        // data through centralised loaders (Supabase-first, IndexedDB as
        // offline fallback).
        // -----------------------------------------------------------------
        hydrate: async () => {
          const sessionUser = await resolveSession();
          const isOnline = canAttemptNetwork();
          const allUsers = isOnline ? await listUsers() : get().users;

          ensureNetworkListeners();

          // Migrar planos legados do localStorage para Dexie (uma única vez)
          await migratePersistedActionPlansToDexie();

          const [loadedEqs, loadedInsps, loadedPlans] = await Promise.all([
            carregarEquipamentos(),
            carregarInspecoes(),
            carregarPlanosDeAcao(),
          ]);

          set({
            equipments: loadedEqs,
            inspections: loadedInsps,
            actionPlans: loadedPlans,
            stats: recomputeStats(loadedEqs),
            user: sessionUser ?? get().user,
            users: allUsers,
            authReady: true,
          });

          await get().refreshPendingCount();
          await get().refreshConflictCount();

          if (sessionUser && isOnline) void runSync();
        },

        refreshPendingCount: async () => {
          if (!isSupabaseConfigured) {
            set({ pending: 0 });
            return;
          }
          const count = await pendingSyncCount();
          set({ pending: count });
        },

        refreshConflictCount: async () => {
          if (!isSupabaseConfigured) {
            set({ conflictCounts: { equipments: 0, actionPlans: 0, inspections: 0 } });
            return;
          }
          const counts = await conflictCount();
          set({ conflictCounts: counts });
        },

        triggerSync: async () => {
          await runSync();
        },

        // -----------------------------------------------------------------
        // Conflict resolution
        // -----------------------------------------------------------------

        resolveEquipmentConflictKeepLocal: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment keep local started: ${id}`);
          const local = await db.equipamentos.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment ${id} not found or not in conflict`);
            return;
          }
          const { sincronizado: _s, pendingDelete: _p, syncAction: _sa, statusUpdatePending: _su, syncConflict: _sc, syncConflictReason: _cr, remoteUpdatedAtAtConflict: _ru, syncError: _se, syncBaseUpdatedAt: _sb, deletedAt: _d, deletedBy: _db, createdAt: _c, updatedAt: _u, ...clean } = local;
          void _s; void _p; void _sa; void _su; void _sc; void _cr; void _ru; void _se; void _sb; void _d; void _db; void _c; void _u;
          const result = await updateEquipmentRemote(clean as Equipment);
          if (result.ok) {
            const now = new Date().toISOString();
            const fetchResult = await fetchEquipmentById(id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : now;
            await db.equipamentos.update(id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              remoteUpdatedAtAtConflict: null,
              syncBaseUpdatedAt: remoteUpdatedAt ?? now,
              updatedAt: remoteUpdatedAt ?? now,
            });
            set((state) => ({
              equipments: state.equipments.map((e) =>
                e.id === id ? { ...e, ...clean, sincronizado: undefined, pendingDelete: undefined, syncAction: undefined, statusUpdatePending: undefined } : e,
              ),
            }));
            if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment keep local success: ${id}`);
          } else {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment keep local failed: ${id}`, result.message);
            throw new Error(result.message || 'Falha ao enviar versão local para o servidor.');
          }
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        resolveEquipmentConflictUseRemote: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment use remote started: ${id}`);
          const local = await db.equipamentos.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment ${id} not found or not in conflict`);
            return;
          }
          const remoteResult = await fetchEquipmentById(id);
          if (!remoteResult.ok) {
            if (remoteResult.code === 'not_found') {
              if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment use remote failed: ${id} — remote was deleted`);
              throw new Error('Este equipamento foi excluído no servidor. Não é possível usar a versão remota.');
            }
            if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment use remote failed: ${id}`);
            throw new Error(remoteResult.message || 'Falha ao buscar versão remota.');
          }
          const remote = remoteResult.data!;
          const now = new Date().toISOString();
          await db.equipamentos.put({
            ...remote,
            sincronizado: true,
            pendingDelete: false,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            remoteUpdatedAtAtConflict: null,
            syncBaseUpdatedAt: remote.updatedAt ?? now,
            updatedAt: remote.updatedAt ?? now,
            deletedAt: remote.deletedAt ?? null,
            deletedBy: remote.deletedBy ?? null,
          } as LocalEquipment);
          set((state) => ({
            equipments: state.equipments.map((e) =>
              e.id === id ? { ...remote } : e,
            ),
          }));
          if (import.meta.env.DEV) console.log(`[conflict-resolution] equipment use remote success: ${id}`);
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        resolveActionPlanConflictKeepLocal: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan keep local started: ${id}`);
          const local = await db.planosAcao.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan ${id} not found or not in conflict`);
            return;
          }
          const { sincronizado: _s, pendingDelete: _p, syncAction: _sa, syncConflict: _sc, syncConflictReason: _cr, remoteUpdatedAtAtConflict: _ru, syncError: _se, syncBaseUpdatedAt: _sb, deletedAt: _d, deletedBy: _db, createdAt: _c, updatedAt: _u, ...clean } = local;
          void _s; void _p; void _sa; void _sc; void _cr; void _ru; void _se; void _sb; void _d; void _db; void _c; void _u;
          const result = await updateActionPlanRemote(clean as ActionPlan);
          if (result.ok) {
            const now = new Date().toISOString();
            const fetchResult = await fetchActionPlanById(id);
            const remoteUpdatedAt = fetchResult.ok && fetchResult.data ? fetchResult.data.updatedAt : now;
            await db.planosAcao.update(id, {
              sincronizado: true,
              syncAction: undefined,
              syncError: undefined,
              syncConflict: false,
              syncConflictReason: undefined,
              remoteUpdatedAtAtConflict: null,
              syncBaseUpdatedAt: remoteUpdatedAt ?? now,
              updatedAt: remoteUpdatedAt ?? now,
            });
            set((state) => ({
              actionPlans: state.actionPlans.map((p) =>
                p.id === id ? { ...p, ...clean, sincronizado: undefined, pendingDelete: undefined, syncAction: undefined } : p,
              ),
            }));
            if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan keep local success: ${id}`);
          } else {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan keep local failed: ${id}`, result.message);
            throw new Error(result.message || 'Falha ao enviar versão local para o servidor.');
          }
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        resolveActionPlanConflictUseRemote: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan use remote started: ${id}`);
          const local = await db.planosAcao.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan ${id} not found or not in conflict`);
            return;
          }
          const remoteResult = await fetchActionPlanById(id);
          if (!remoteResult.ok) {
            if (remoteResult.code === 'not_found') {
              if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan use remote failed: ${id} — remote was deleted`);
              throw new Error('Este plano de ação foi excluído no servidor. Não é possível usar a versão remota.');
            }
            if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan use remote failed: ${id}`);
            throw new Error(remoteResult.message || 'Falha ao buscar versão remota.');
          }
          const remote = remoteResult.data!;
          const now = new Date().toISOString();
          await db.planosAcao.put({
            ...remote,
            sincronizado: true,
            pendingDelete: false,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            remoteUpdatedAtAtConflict: null,
            syncBaseUpdatedAt: remote.updatedAt ?? now,
            updatedAt: remote.updatedAt ?? now,
            deletedAt: remote.deletedAt ?? null,
            deletedBy: remote.deletedBy ?? null,
          } as LocalActionPlan);
          set((state) => ({
            actionPlans: state.actionPlans.map((p) =>
              p.id === id ? { ...remote } : p,
            ),
          }));
          if (import.meta.env.DEV) console.log(`[conflict-resolution] action plan use remote success: ${id}`);
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        clearLocalData: async () => {
          await limparCacheLocalDoApp();

          // Clear Zustand persist store from localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('firecheck-storage');
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.clear();
          }

          // Clear PWA / service worker caches
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(
              cacheKeys
                .filter((k) => k.startsWith('firecheck') || k.startsWith('supabase'))
                .map((k) => caches.delete(k)),
            );
          } catch { /* caches API may not be available */ }

          set({
            equipments: [],
            inspections: [],
            stats: recomputeStats([]),
            actionPlans: [],
          });
        },

        // -----------------------------------------------------------------
        // Mutations
        // -----------------------------------------------------------------
        addEquipment: async (newEq): Promise<EquipmentResult> => {
          const now = new Date().toISOString();
          const stamped: Equipment = {
            ...newEq,
            createdBy: newEq.createdBy ?? get().user?.id,
            createdAt: now,
            updatedAt: now,
          };

          // Persistir localmente com metadados de sync
          try {
            await db.equipamentos.put({
              ...stamped,
              sincronizado: false,
              pendingDelete: false,
              syncAction: 'create',
              deletedAt: null,
              deletedBy: null,
            } as LocalEquipment);
          } catch (err) {
            console.error('[store.addEquipment] erro ao persistir no Dexie:', err);
            return { ok: false, mode: 'local', message: 'Erro ao salvar no banco local.' };
          }

          set((state) => {
            const updated = [stamped, ...state.equipments];
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });

          // Tentar push imediato se online
          let mode: EquipmentResult['mode'] = 'local';
          let message: string | undefined;

          if (isSupabaseConfigured && supabase && canAttemptNetwork()) {
            const result = await createEquipmentRemote(stamped);
            if (result.ok) {
              await db.equipamentos.update(stamped.id, {
                sincronizado: true,
                syncAction: undefined,
                syncError: undefined,
              });
              mode = 'cloud';
            } else if (result.code === 'duplicate') {
              // Reverter criação local — TAG já existe no servidor
              await db.equipamentos.delete(stamped.id).catch(() => {});
              set((state) => ({
                equipments: state.equipments.filter((e) => e.id !== stamped.id),
                stats: recomputeStats(state.equipments.filter((e) => e.id !== stamped.id)),
              }));
              return { ok: false, mode: 'local', message: result.message || 'Já existe um equipamento ativo com esta TAG.' };
            } else {
              message = 'Equipamento salvo localmente. A TAG será validada na sincronização.';
            }
          } else {
            message = 'Equipamento salvo localmente e pendente de sincronização.';
          }

          // Sync de background para outros itens pendentes
          if (isSupabaseConfigured) {
            void runSync().then(() => get().refreshPendingCount());
          }

          return { ok: true, mode, message };
        },

        updateEquipment: async (id, updates): Promise<EquipmentResult> => {
          const current = get().equipments.find((e) => e.id === id);
          if (!current) {
            return { ok: false, mode: 'local', message: 'Equipamento não encontrado.' };
          }

          // Bloquear alteração manual de status — é atualizado apenas pelo fluxo de inspeção
          const safeUpdates = { ...updates };
          delete (safeUpdates as Record<string, unknown>).status;

          const updated: Equipment = {
            ...current,
            ...safeUpdates,
            updatedAt: new Date().toISOString(),
          };

          // Persistir localmente
          try {
            await db.equipamentos.update(id, {
              ...updated,
              sincronizado: false,
              syncAction: 'update',
            } as Partial<LocalEquipment>);
          } catch (err) {
            console.error('[store.updateEquipment] erro ao atualizar no Dexie:', err);
            return { ok: false, mode: 'local', message: 'Erro ao salvar localmente.' };
          }

          set((state) => {
            const updatedEqs = state.equipments.map((e) =>
              e.id === id ? updated : e,
            );
            return {
              equipments: updatedEqs,
              stats: recomputeStats(updatedEqs),
            };
          });

          // Tentar push imediato se online
          if (isSupabaseConfigured && supabase && canAttemptNetwork()) {
            const result = await updateEquipmentRemote(updated);
            if (result.ok) {
              await db.equipamentos.update(id, {
                sincronizado: true,
                syncAction: undefined,
                syncError: undefined,
              });
              return { ok: true, mode: 'cloud' };
            }
            return {
              ok: true,
              mode: 'local',
              message: 'Atualização salva localmente. Pendente de sincronização.',
            };
          }

          if (isSupabaseConfigured) {
            void runSync().then(() => get().refreshPendingCount());
          }
          return {
            ok: true,
            mode: 'local',
            message: 'Atualização salva localmente. Pendente de sincronização.',
          };
        },

        updateInspection: async (id, updates): Promise<InspectionSaveResult> => {
          // Inspeções compartilhadas: admin ou inspetor podem editar qualquer uma.
          if (!canEditInspection(get().user, {})) {
            return { ok: false, mode: 'local', message: 'Sem permissão para editar inspeções.' };
          }

          const current = await db.inspecoes.get(id);
          if (!current) {
            return { ok: false, mode: 'local', message: 'Inspeção não encontrada.' };
          }

          const now = new Date().toISOString();
          const safeUpdates: Partial<LocalInspection> = {
            data: updates.data ?? current.data,
            status: updates.status,
            observacoes: updates.observacoes ?? '',
            updatedAt: now,
            updatedBy: get().user?.id,
            updatedByName: updates.updatedByName,
            sincronizado: false,
            syncAction: 'update',
          };

          // A edição NUNCA ajusta autoria original da inspeção.
          try {
            await db.inspecoes.update(id, safeUpdates);
          } catch (err) {
            console.error('[store.updateInspection] erro ao persistir no Dexie:', err);
            return { ok: false, mode: 'local', message: 'Erro ao salvar localmente.' };
          }

          set((state) => ({
            inspections: state.inspections.map((i) =>
              i.id === id
                ? {
                    ...i,
                    data: safeUpdates.data ?? i.data,
                    status: safeUpdates.status ?? i.status,
                    observacoes: (safeUpdates.observacoes ?? '') || undefined,
                    updatedAt: now,
                    updatedBy: get().user?.id,
                    updatedByName: updates.updatedByName,
                  }
                : i,
            ),
          }));

          // Recalcula o status do EQUIPAMENTO localmente SOMENTE se a inspeção
          // editada for a mais recente do equipamento (evita regressão por
          // edição de inspeção antiga).
          const allLocal = await db.inspecoes.toArray();
          const latest = getLatestInspectionForEquipment(allLocal as Inspection[], current.equipmentId);
          const isLatest = latest?.id === id;
          if (isLatest) {
            const eqStatus = safeUpdates.status as EquipmentStatus;
            await db.equipamentos.update(current.equipmentId, {
              status: eqStatus,
              dataUltimaInspecao: safeUpdates.data ?? current.data,
              sincronizado: false,
              statusUpdatePending: true,
              updatedAt: now,
            } as Partial<LocalEquipment>);
            set((state) => ({
              equipments: state.equipments.map((e) =>
                e.id === current.equipmentId
                  ? { ...e, status: eqStatus, dataUltimaInspecao: safeUpdates.data ?? current.data }
                  : e,
              ),
            }));
          }

          // Pipeline ÚNICO de envio remoto: a alteração já está no Dexie
          // (sincronizado=false, syncAction='update') e no Zustand. O push é
          // SEMPRE feito por runSync() → pushInspections() — não existe writer
          // direto concorrente competindo pela mesma linha de inspeção.
          await runSync();

          const fresh = await db.inspecoes.get(id);
          if (fresh?.syncConflict) {
            return {
              ok: true,
              mode: 'local',
              conflict: true,
              message: fresh.syncConflictReason
                ?? 'Esta inspeção foi alterada em outro dispositivo depois da última sincronização.',
            };
          }
          if (fresh?.sincronizado) {
            return { ok: true, mode: 'cloud' };
          }
          return {
            ok: true,
            mode: 'local',
            message: 'Alteração salva neste dispositivo. Será sincronizada quando houver conexão.',
          };
        },

        resolveInspectionConflictKeepLocal: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] inspection keep local started: ${id}`);
          const local = await db.inspecoes.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] inspection ${id} not found or not in conflict`);
            return;
          }
          if (!canEditInspection(get().user, { userId: local.userId })) {
            throw new Error('Sem permissão para resolver o conflito desta inspeção.');
          }

          // Refresca a base CAS com o estado remoto atual, depois envia nossa
          // versão (CAS condicionado ao updated_at mais recente).
          const remoteResult = await fetchInspectionById(id);
          if (!remoteResult.ok) {
            if (remoteResult.code === 'not_found') {
              throw new Error('Esta inspeção foi excluída no servidor. Use "Usar versão do servidor" para remover a versão local.');
            }
            throw new Error(remoteResult.message || 'Falha ao buscar versão remota.');
          }
          const remote = remoteResult.data!;

          const result = await updateInspectionRemote({
            id,
            data: local.data,
            status: local.status,
            observacoes: local.observacoes ?? '',
            updatedByName: local.updatedByName ?? '',
            syncBaseUpdatedAt: remote.updatedAt ?? null,
          });

          if (!result.ok) {
            if (result.code === 'conflict') {
              throw new Error('O servidor mudou novamente durante a resolução. Tente de novo.');
            }
            throw new Error(result.message || 'Falha ao enviar versão local para o servidor.');
          }

          await db.inspecoes.update(id, {
            sincronizado: true,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            remoteUpdatedAtAtConflict: null,
            syncBaseUpdatedAt: result.row.updated_at,
            updatedAt: result.row.updated_at,
            updatedBy: result.row.updated_by ?? undefined,
            updatedByName: result.row.updated_by_name ?? local.updatedByName,
          });

          // Recálculo do status do equipamento (por garantia, sem p_next).
          const eqId = result.row.equipment_id;
          const rpc = await recalculateEquipmentFromLatestInspectionRemote(eqId, undefined, id);
          if (rpc.ok && rpc.data) {
            const rpcData = rpc.data as Record<string, unknown>;
            await db.equipamentos.update(eqId, {
              sincronizado: true,
              statusUpdatePending: undefined,
              status: typeof rpcData.status === 'string' ? (rpcData.status as EquipmentStatus) : undefined,
            } as Partial<LocalEquipment>);
          }

          set((state) => ({
            inspections: state.inspections.map((i) =>
              i.id === id
                ? {
                    ...i,
                    data: result.row.data,
                    status: result.row.status as EquipmentStatus,
                    observacoes: result.row.observacoes || undefined,
                    updatedAt: result.row.updated_at,
                    updatedBy: result.row.updated_by ?? undefined,
                    updatedByName: result.row.updated_by_name ?? local.updatedByName,
                  }
                : i,
            ),
          }));

          if (import.meta.env.DEV) console.log('[conflict-resolution] inspection keep local success: ', id, '→ conflict resolved: keep local');
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        resolveInspectionConflictUseRemote: async (id: string) => {
          if (import.meta.env.DEV) console.log(`[conflict-resolution] inspection use remote started: ${id}`);
          const local = await db.inspecoes.get(id);
          if (!local || !local.syncConflict) {
            if (import.meta.env.DEV) console.log(`[conflict-resolution] inspection ${id} not found or not in conflict`);
            return;
          }
          if (!canViewInspection(get().user)) {
            throw new Error('Sem permissão para visualizar esta inspeção.');
          }

          const remoteResult = await fetchInspectionById(id);
          if (!remoteResult.ok) {
            if (remoteResult.code === 'not_found') {
              // Excluída no servidor: remove a versão local.
              await db.inspecoes.delete(id);
              set((state) => ({
                inspections: state.inspections.filter((i) => i.id !== id),
              }));
              if (import.meta.env.DEV) console.log('[conflict-resolution] inspection use remote: removed local copy (remote deleted) ', id);
              await get().refreshConflictCount();
              await get().refreshPendingCount();
              return;
            }
            throw new Error(remoteResult.message || 'Falha ao buscar versão remota.');
          }

          const remote = remoteResult.data!;
          const now = new Date().toISOString();
          await db.inspecoes.put({
            ...remote,
            sincronizado: true,
            pendingDelete: false,
            syncAction: undefined,
            syncError: undefined,
            syncConflict: false,
            syncConflictReason: undefined,
            remoteUpdatedAtAtConflict: null,
            syncBaseUpdatedAt: remote.updatedAt ?? now,
            updatedAt: remote.updatedAt ?? now,
          } as LocalInspection);

          set((state) => ({
            inspections: state.inspections.map((i) => (i.id === id ? { ...remote } : i)),
          }));

          if (import.meta.env.DEV) console.log('[conflict-resolution] inspection use remote success: ', id, '→ conflict resolved: use remote');
          await get().refreshConflictCount();
          await get().refreshPendingCount();
        },

        deleteEquipment: (id) => {
          const userId = get().user?.id;
          const now = new Date().toISOString();
          set((state) => {
            const updated = state.equipments.filter((eq) => eq.id !== id);
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });
          void db.equipamentos.update(id, {
            pendingDelete: true,
            sincronizado: false,
            syncAction: 'delete',
            deletedAt: now,
            deletedBy: userId ?? null,
            updatedAt: now,
          });
          void runSync().then(() => get().refreshPendingCount());
        },

        deleteInspection: async (id) => {
          // Guarda de permissão: somente ADMIN pode excluir inspeções.
          if (!canDeleteInspection(get().user, { userId: get().inspections.find((i) => i.id === id)?.userId })) {
            console.warn('[store.deleteInspection] Sem permissão para excluir inspeção — admin apenas.');
            return;
          }

          // Ordem obrigatória (sem race): primeiro persiste a intenção de
          // exclusão no Dexie, SOMENTE DEPOIS reflete na UI e dispara o sync.
          // O push nunca pode iniciar antes de pendingDelete/syncAction
          // estarem gravados.
          await db.inspecoes.update(id, {
            pendingDelete: true,
            sincronizado: false,
            syncAction: 'delete',
          });

          set((state) => ({
            inspections: state.inspections.filter((i) => i.id !== id),
          }));

          await runSync();
          await get().refreshPendingCount();
          await get().refreshConflictCount();
        },

        addInspection: async (data) => {
          const inspectionId = data.inspectionId;
          const userId = data.userId ?? get().user?.id;

          // -----------------------------------------------------------------
          // GUARDA DE IDEMPOTÊNCIA da tentativa: se já existe registro local
          // com este inspectionId, a mesma tentativa foi processada antes
          // (double/triple submit, retry após erro incerto). NUNCA geramos
          // outro ID — convergimos para o registro existente.
          // -----------------------------------------------------------------
          const existing = await db.inspecoes.get(inspectionId);
          if (existing) {
            if (existing.equipmentId === data.equipmentId) {
              // A inspeção e a foto são persistidas NA MESMA transação, logo,
              // se a inspeção existe, a foto (quando havia) também foi gravada
              // atomicamente — NÃO há repair de foto (documentado, §15).
              if (existing.status === 'pendente' || existing.status === 'vencido') {
                const planId = `PAC-${inspectionId}`;
                const plan = await db.planosAcao.get(planId);
                if (!plan) {
                  // REPARO IDEMPOTENTE CONTROLADO (§12/§13/§14): plano
                  // derivado ausente (criado por versão anterior ou falha
                  // parcial). NÃO cria nova inspeção; cria SÓ o plano faltante
                  // com o ID determinístico — e jamais sobrescreve plano
                  // existente (check duplo dentro da transação).
                  const eq = await db.equipamentos.get(existing.equipmentId);
                  const descObs = existing.observacoes || 'Não conformidade identificada durante inspeção';
                  const now = new Date().toISOString();
                  const repairedPlan: LocalActionPlan = {
                    id: planId,
                    equipmentId: existing.equipmentId,
                    local: eq?.local || 'Local não especificado',
                    descricao: descObs,
                    criticidade: inferCriticidade(descObs, eq?.tipo || ''),
                    responsavel: '',
                    prazo: '',
                    status: 'Aberta',
                    createdAt: now.split('T')[0],
                    userId,
                    updatedAt: now,
                    sincronizado: false,
                    pendingDelete: false,
                    syncAction: 'create',
                    deletedAt: null,
                    deletedBy: null,
                  };
                  await db.transaction('rw', db.planosAcao, async () => {
                    if (await db.planosAcao.get(planId)) return;
                    await db.planosAcao.put(repairedPlan);
                  });
                  // Zustand reflete APENAS o que já foi gravado no Dexie.
                  set((state) => ({
                    actionPlans: [stripActionPlanSyncMeta(repairedPlan), ...state.actionPlans],
                  }));
                  void runSync().then(() => get().refreshPendingCount());
                  if (import.meta.env.DEV) {
                    console.log(`[inspection-create] repaired missing action plan ${planId}`);
                  }
                  return {
                    ok: true,
                    inspectionSaved: true,
                    photoSaved: true,
                    inspectionId,
                    idempotent: true,
                    repairedActionPlan: true,
                  };
                }
                // Plano já existe → NÃO recriar / resetar responsável / prazo /
                // status. Sucesso idempotente simples.
              }
              if (import.meta.env.DEV) {
                console.log(`[inspection-create] existing local inspection reused ${inspectionId}`);
              }
              return {
                ok: true,
                inspectionSaved: true,
                photoSaved: true,
                inspectionId,
                idempotent: true,
              };
            }
            // Colisão: o ID da tentativa já pertence a outro contexto. Erro
            // explícito — nunca cria um registro novo em silêncio.
            return {
              ok: false,
              inspectionSaved: false,
              photoSaved: false,
              error: 'Conflito de tentativa de inspeção (ID já utilizado em outro equipamento). Recarregue a tela e tente novamente.',
            };
          }

          // Foto com ID derivado da tentativa: mesmo retry usa a MESMA foto
          // (FOTO-<inspectionId>) — no máximo 1 registro de foto por tentativa.
          const photoId = data.photo ? `FOTO-${inspectionId}` : undefined;

          // Plano automático (quando aplicável) construído ANTES da transação,
          // com base no equipamento atual — será persistido DENTRO da mesma
          // transação atômica (§5/§6/§7). ID obrigatório: PAC-<inspectionId>.
          let newPlan: LocalActionPlan | null = null;
          if (data.status === 'pendente' || data.status === 'vencido') {
            const eq = get().equipments.find((e) => e.id === data.equipmentId);
            const descObs = data.observacoes || 'Não conformidade identificada durante inspeção';
            const now = new Date().toISOString();
            newPlan = {
              id: `PAC-${inspectionId}`,
              equipmentId: data.equipmentId,
              local: eq?.local || 'Local não especificado',
              descricao: descObs,
              criticidade: inferCriticidade(descObs, eq?.tipo || ''),
              responsavel: '',
              prazo: '',
              status: 'Aberta',
              createdAt: now.split('T')[0],
              userId,
              updatedAt: now,
              sincronizado: false,
              pendingDelete: false,
              syncAction: 'create',
              deletedAt: null,
              deletedBy: null,
            };
          }

          const stamped: Inspection = {
            id: inspectionId,
            equipmentId: data.equipmentId,
            data: data.data,
            inspetor: data.inspetor,
            status: data.status,
            observacoes: data.observacoes || undefined,
            userId,
          };

          // 1. Persistir inspeção + foto (se houver) + status do equipamento +
          //    plano de ação (se aplicável) ATOMICAMENTE. Se QUALQUER gravação
          //    falhar (inclusive o plano), o Dexie reverte TUDO — inspeção não
          //    existe, foto não existe, equipamento inalterado, plano não existe
          //    — e retornamos erro sem falso sucesso (§7/§10/§16–§23).
          try {
            const now = new Date().toISOString();
            await db.transaction('rw', db.inspecoes, db.fotos, db.equipamentos, db.planosAcao, async () => {
              await db.inspecoes.put({
                ...stamped,
                sincronizado: false,
                syncAction: 'create',
                createdAt: now,
                updatedAt: now,
              } as LocalInspection);

              if (data.photo && photoId) {
                await db.fotos.put({
                  id: photoId,
                  inspectionId,
                  blob: data.photo.blob,
                  mimeType: data.photo.mimeType,
                  width: data.photo.width,
                  height: data.photo.height,
                  size: data.photo.size,
                  sincronizado: false,
                  syncAction: 'create',
                  createdAt: now,
                  updatedAt: now,
                } as LocalInspectionPhoto);
              }

              await db.equipamentos.where('id').equals(data.equipmentId).modify((eq) => {
                eq.status = data.status;
                eq.sincronizado = false;
                eq.statusUpdatePending = true;
                eq.updatedAt = new Date().toISOString();
                if (data.dataProximaInspecao) {
                  eq.dataProximaInspecao = data.dataProximaInspecao;
                }
              });

              // Plano DENTRO da transação (nunca fire-and-forget): se este put
              // falhar a transação inteira faz rollback.
              if (newPlan) {
                await db.planosAcao.put(newPlan);
              }
            });
          } catch (err) {
            console.error('[store.addInspection] erro ao persistir inspeção no Dexie:', err);
            return {
              ok: false,
              inspectionSaved: false,
              photoSaved: !data.photo,
              error: 'Não foi possível salvar a inspeção no dispositivo. Nenhuma alteração foi concluída.',
            };
          }

          // 2. Update Zustand state — APÓS o commit da transação. Reflete
          //    apenas o que JÁ foi persistido. Nenhuma escrita Dexie aqui.
          set((state) => {
            const updatedEquipments = state.equipments.map((eq) =>
              eq.id === data.equipmentId
                ? { ...eq, status: data.status, dataProximaInspecao: data.dataProximaInspecao ?? eq.dataProximaInspecao }
                : eq,
            );

            return {
              inspections: [stamped, ...state.inspections],
              equipments: updatedEquipments,
              stats: recomputeStats(updatedEquipments),
              actionPlans: newPlan ? [stripActionPlanSyncMeta(newPlan), ...state.actionPlans] : state.actionPlans,
            };
          });

          // 3. Trigger sync once — após commit (§24/§25).
          void runSync().then(() => get().refreshPendingCount());

          return { ok: true, inspectionSaved: true, photoSaved: true, inspectionId };
        },

        addActionPlan: (plan) => {
          const now = new Date().toISOString();
          const id = `PAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newPlan: ActionPlan = {
            ...plan,
            id,
            status: plan.status ?? 'Aberta',
            createdAt: now.split('T')[0],
            userId: plan.userId ?? get().user?.id,
            updatedAt: now,
          };

          void db.planosAcao.put({
            ...newPlan,
            sincronizado: false,
            pendingDelete: false,
            syncAction: 'create',
            deletedAt: null,
            deletedBy: null,
          } as LocalActionPlan).then(() => {
            set((state) => ({
              actionPlans: [newPlan, ...state.actionPlans],
            }));
          });
          void runSync().then(() => get().refreshPendingCount());
        },

        updateActionPlan: (id, updates) => {
          const now = new Date().toISOString();
          void db.planosAcao.update(id, {
            ...updates,
            sincronizado: false,
            syncAction: 'update',
            updatedAt: now,
          } as Partial<LocalActionPlan>).then(() => {
            set((state) => ({
              actionPlans: state.actionPlans.map((ap) =>
                ap.id === id ? { ...ap, ...updates } : ap,
              ),
            }));
          });
          void runSync().then(() => get().refreshPendingCount());
        },

        deleteActionPlan: (id) => {
          const now = new Date().toISOString();
          void db.planosAcao.get(id).then((plan) => {
            if (!plan) return;
            if (plan.sincronizado) {
              void db.planosAcao.update(id, {
                pendingDelete: true,
                sincronizado: false,
                deletedAt: now,
                updatedAt: now,
              } as Partial<LocalActionPlan>);
            } else {
              void db.planosAcao.delete(id);
            }
          });
          set((state) => ({
            actionPlans: state.actionPlans.filter((ap) => ap.id !== id),
          }));
          void runSync().then(() => get().refreshPendingCount());
        },

        // -----------------------------------------------------------------
        // User management (admin only — enforcement is at the call site)
        // -----------------------------------------------------------------
        loadUsers: async () => {
          set({ usersLoading: true });
          try {
            const users = await listUsers();
            set({ users, usersLoading: false });
          } catch (err) {
            console.error('[store.loadUsers]', err);
            set({ usersLoading: false });
          }
        },

        setUserRole: async (id, role) => {
          await setUserRole(id, role);
          const users = await listUsers();
          set({ users });
        },

        deleteUserAccount: async (id) => {
          const current = get().user;
          if (current?.id === id) {
            throw new Error('Você não pode excluir a própria conta por aqui.');
          }
          await deleteUser(id);
          const users = await listUsers();
          set({ users });
        },
      };
    },
    {
      name: 'firecheck-storage',
      version: 3,
      // Persist only the small/user-scoped data. Equipments, inspections &
      // action plans now live in Dexie and are loaded via `hydrate()`.
      // `user` is no longer persisted — it is re-derived on each launch from
      // the Supabase session + the `profiles` table (see `resolveSession`).
      partialize: (state) => ({
        config: state.config,
        users: state.users,
      }),
      migrate: (persistedState, version) => {
        const base = (persistedState && typeof persistedState === 'object'
          ? persistedState
          : {}) as { config?: AppConfig; user?: unknown };
        if (version < 2) {
          const { user: _drop, ...rest } = base;
          void _drop;
          return {
            config: rest.config ?? {
              empresa: 'FireCheck Corp',
              unidade: 'Sede São Paulo',
              offlineMode: false,
              notificationsEnabled: true,
            },
          };
        }
        return {
          config: base.config ?? {
            empresa: 'FireCheck Corp',
            unidade: 'Sede São Paulo',
            offlineMode: false,
            notificationsEnabled: true,
          },
        };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Reage a mudanças de sessão do Supabase (login, logout, refresh, recovery).
// Sincroniza `user`/`authReady` com o estado real da sessão e dispara sync.
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined' && supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    void (async () => {
      const store = useAppStore.getState();
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const user = await resolveSession();
        if (user) {
          useAppStore.setState({ user, authReady: true });
          if (event === 'SIGNED_IN') void store.triggerSync();
        }
      } else if (event === 'SIGNED_OUT') {
        useAppStore.setState({ user: null, authReady: true });
      } else if (event === 'PASSWORD_RECOVERY') {
        // O usuário está no fluxo de recovery; o componente que chamou
        // verifyOtp já cuida da próxima etapa.
        useAppStore.setState({ authReady: true });
      }
      // `event` carrega também `INITIAL_SESSION` no primeiro carregamento —
      // nesse caso o `hydrate()` já lida, então não duplicamos.
      void session;
    })();
  });
}

// Auto-sync é gerenciado centralmente pelo hook useAutoSync em AppLayout.
// Os listeners duplicados foram removidos para evitar chamadas sem throttle.
