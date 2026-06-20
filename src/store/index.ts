import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Equipment, Inspection, Inspector, Stats, ActionPlan, ActionPlanStatus, AppConfig, EquipmentStatus } from '../types';
import { db, type LocalEquipment, type LocalInspection, type LocalActionPlan } from '../db';
import { syncAll, pendingSyncCount } from '../services/sync';
import { carregarEquipamentos, limparCacheLocalDoApp, createEquipmentRemote, updateEquipmentRemote } from '../services/equipmentService';
import { carregarInspecoes } from '../services/inspectionService';
import { carregarPlanosDeAcao } from '../services/actionPlanService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
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

  // ---- actions ----
  login: (email: string, pass: string) => Promise<void>;
  register: (input: { email: string; password: string; nome: string; cargo: string }) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentTab: (tab: Tab) => void;
  addInspection: (data: {
    equipmentId: string;
    data: string;
    inspetor: string;
    status: EquipmentStatus;
    observacoes?: string;
    userId?: string;
    photoBase64?: string | null;
    dataProximaInspecao?: string;
  }) => Promise<string>;
  addEquipment: (eq: Equipment) => Promise<EquipmentResult>;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<EquipmentResult>;
  addActionPlan: (plan: Omit<ActionPlan, 'id' | 'createdAt' | 'status'> & { status?: ActionPlanStatus }) => void;
  updateActionPlan: (id: string, updates: Partial<ActionPlan>) => void;
  deleteActionPlan: (id: string) => void;
  deleteEquipment: (id: string) => void;
  deleteInspection: (id: string) => void;
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
        return rows.map(({ sincronizado: _s, pendingDelete: _p, syncAction: _a, syncError: _e, ...rest }) => {
          void _s; void _p; void _a; void _e;
          return rest as ActionPlan;
        });
      };

      const runSync = async (): Promise<void> => {
        if (!isSupabaseConfigured) return;
        if (!navigator.onLine) {
          await get().refreshPendingCount();
          return;
        }
        set({ syncing: true });
        try {
          const report = await syncAll({ userId: get().user?.id });

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
              const { sincronizado: _s, pendingDelete: _p, ...clean } = e;
              void _s; void _p;
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
          const allUsers = await listUsers();
          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

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

        triggerSync: async () => {
          await runSync();
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

          if (isSupabaseConfigured && supabase && navigator.onLine) {
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

          const updated: Equipment = {
            ...current,
            ...updates,
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
          if (isSupabaseConfigured && supabase && navigator.onLine) {
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

        deleteInspection: (id) => {
          set((state) => ({
            inspections: state.inspections.filter((i) => i.id !== id),
          }));
          void db.inspecoes.update(id, { pendingDelete: true, sincronizado: false });
          void runSync().then(() => get().refreshPendingCount());
        },

        addInspection: async (data) => {
          const id = `INSP-${crypto.randomUUID()}`;
          const userId = data.userId ?? get().user?.id;

          const stamped: Inspection = {
            id,
            equipmentId: data.equipmentId,
            data: data.data,
            inspetor: data.inspetor,
            status: data.status,
            observacoes: data.observacoes || undefined,
            userId,
          };

          // 1. Save inspection to Dexie
          try {
            await db.inspecoes.put({ ...stamped, sincronizado: false } as LocalInspection);
          } catch (err) {
            console.error('[store.addInspection] erro ao persistir inspeção no Dexie:', err);
            throw Error('Falha ao salvar inspeção no banco local.', { cause: err });
          }

          // 2. Save photo to Dexie if provided
          if (data.photoBase64) {
            try {
              await db.fotos.put({
                id,
                inspectionId: id,
                base64: data.photoBase64,
              });
            } catch (err) {
              console.error('[store.addInspection] erro ao persistir foto no Dexie:', err);
            }
          }

          // 3. Update equipment in Dexie
          try {
            await db.equipamentos.where('id').equals(data.equipmentId).modify((eq) => {
              eq.status = data.status;
              eq.sincronizado = false;
              eq.statusUpdatePending = true;
              eq.updatedAt = new Date().toISOString();
              if (data.dataProximaInspecao) {
                eq.dataProximaInspecao = data.dataProximaInspecao;
              }
            });
          } catch (err) {
            console.error('[store.addInspection] erro ao atualizar equipamento no Dexie:', err);
          }

          // 4. Update Zustand state
          let actionPlanId: string | null = null;
          set((state) => {
            const updatedInspections = [stamped, ...state.inspections];
            const updatedEquipments = state.equipments.map((eq) =>
              eq.id === data.equipmentId
                ? { ...eq, status: data.status, dataProximaInspecao: data.dataProximaInspecao ?? eq.dataProximaInspecao }
                : eq,
            );

            let updatedActionPlans = [...state.actionPlans];

            if (data.status === 'vencido' || data.status === 'pendente') {
              const eq = updatedEquipments.find((e) => e.id === data.equipmentId);
              const descObs = data.observacoes || 'Não conformidade identificada durante inspeção';
              actionPlanId = `PAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              const now = new Date().toISOString();
              const newPlan: ActionPlan = {
                id: actionPlanId,
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
              };

              // Also write to Dexie
              void db.planosAcao.put({
                ...newPlan,
                sincronizado: false,
                pendingDelete: false,
                syncAction: 'create',
                deletedAt: null,
                deletedBy: null,
              } as LocalActionPlan).catch((err) => {
                console.error('[store.addInspection] erro ao persistir plano no Dexie:', err);
              });

              updatedActionPlans = [newPlan, ...state.actionPlans];
            }

            return {
              inspections: updatedInspections,
              equipments: updatedEquipments,
              stats: recomputeStats(updatedEquipments),
              actionPlans: updatedActionPlans,
            };
          });

          // 5. Trigger sync once
          void runSync().then(() => get().refreshPendingCount());

          return id;
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

// ---------------------------------------------------------------------------
// Auto-sync listeners (browser only)
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[firecheck] online — triggering sync');
    void useAppStore.getState().triggerSync();
  });
  window.addEventListener('offline', () => {
    console.log('[firecheck] offline — sync disabled until reconnect');
  });
}
