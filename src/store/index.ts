import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Equipment, Inspection, Inspector, Stats, ActionPlan, ActionPlanStatus, AppConfig, EquipmentStatus } from '../types';
import { db, type LocalActionPlan, type LocalEquipment, type LocalInspection } from '../db';
import { syncAll, pendingSyncCount } from '../services/sync';
import { carregarEquipamentos, limparCacheLocalDoApp } from '../services/equipmentService';
import { carregarInspecoes } from '../services/inspectionService';
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
  /** Sync metadata for action plans (sincronizado, pendingDelete). */
  actionPlanMeta: Record<string, { sincronizado: boolean; pendingDelete: boolean }>;
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
  addEquipment: (eq: Equipment) => void;
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
      const runSync = async (): Promise<void> => {
        if (!isSupabaseConfigured) return;
        if (!navigator.onLine) {
          await get().refreshPendingCount();
          return;
        }
        set({ syncing: true });
        try {
          const meta = get().actionPlanMeta;
          const plans = get().actionPlans;
          // Build sync queue from visible plans + pending-delete plans not in visible list
          const localActionPlans: LocalActionPlan[] = [];
          const seenIds = new Set<string>();
          for (const p of plans) {
            const m = meta[p.id];
            if (m?.pendingDelete || m?.sincronizado === false || m === undefined) {
              localActionPlans.push({
                ...p,
                sincronizado: m?.sincronizado ?? true,
                pendingDelete: m?.pendingDelete ?? false,
              } as LocalActionPlan);
              seenIds.add(p.id);
            }
          }
          // Include pending-delete entries not present in actionPlans (removed from UI)
          for (const [id, m] of Object.entries(meta)) {
            if (m.pendingDelete && !seenIds.has(id)) {
              // We don't have the full plan data, but we only need id + flags for delete
              localActionPlans.push({
                id,
                equipmentId: '',
                local: '',
                descricao: '',
                criticidade: 'Baixo',
                responsavel: '',
                prazo: '',
                status: 'Aberta',
                createdAt: '',
                sincronizado: false,
                pendingDelete: true,
              } as LocalActionPlan);
              seenIds.add(id);
            }
          }
          const report = await syncAll(localActionPlans, { userId: get().user?.id });
          // Mark action plans as synced after successful push
          if (report.pushedActionPlanIds.length > 0) {
            set((state) => {
              const newMeta = { ...state.actionPlanMeta };
              for (const id of report.pushedActionPlanIds) {
                newMeta[id] = { ...newMeta[id], sincronizado: true };
              }
              return { actionPlanMeta: newMeta };
            });
          }
          // Remove action plans that were deleted from cloud
          if (report.deletedActionPlanIds.length > 0) {
            set((state) => {
              const newMeta = { ...state.actionPlanMeta };
              for (const id of report.deletedActionPlanIds) {
                delete newMeta[id];
              }
              return {
                actionPlans: state.actionPlans.filter((p) => !report.deletedActionPlanIds.includes(p.id)),
                actionPlanMeta: newMeta,
              };
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
        actionPlanMeta: {},
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

          const [loadedEqs, loadedInsps] = await Promise.all([
            carregarEquipamentos(),
            carregarInspecoes(),
          ]);

          set({
            equipments: loadedEqs,
            inspections: loadedInsps,
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
          const cloudPending = await pendingSyncCount();
          const meta = get().actionPlanMeta;
          const localPending = Object.values(meta).filter(
            (m) => !m.sincronizado || m.pendingDelete,
          ).length;
          set({ pending: cloudPending + localPending });
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
            actionPlanMeta: {},
          });
        },

        // -----------------------------------------------------------------
        // Mutations
        // -----------------------------------------------------------------
        addEquipment: (newEq) => {
          const now = new Date().toISOString();
          const stamped: Equipment = {
            ...newEq,
            createdBy: newEq.createdBy ?? get().user?.id,
            createdAt: now,
            updatedAt: now,
          };
          set((state) => {
            const updated = [stamped, ...state.equipments];
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });
          db.equipamentos.put({
            ...stamped,
            sincronizado: false,
            pendingDelete: false,
            deletedAt: null,
            deletedBy: null,
          } as LocalEquipment).catch((err) =>
            console.error('[store.addEquipment] erro ao persistir no Dexie:', err),
          );
          void runSync().then(() => get().refreshPendingCount());
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
            const updatedMeta = { ...state.actionPlanMeta };

            if (data.status === 'vencido' || data.status === 'pendente') {
              const eq = updatedEquipments.find((e) => e.id === data.equipmentId);
              const descObs = data.observacoes || 'Não conformidade identificada durante inspeção';
              actionPlanId = `PAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              const newPlan: ActionPlan = {
                id: actionPlanId,
                equipmentId: data.equipmentId,
                local: eq?.local || 'Local não especificado',
                descricao: descObs,
                criticidade: inferCriticidade(descObs, eq?.tipo || ''),
                responsavel: '',
                prazo: '',
                status: 'Aberta',
                createdAt: new Date().toISOString().split('T')[0],
                userId,
              };
              updatedActionPlans = [newPlan, ...state.actionPlans];
              updatedMeta[actionPlanId] = { sincronizado: false, pendingDelete: false };
            }

            return {
              inspections: updatedInspections,
              equipments: updatedEquipments,
              stats: recomputeStats(updatedEquipments),
              actionPlans: updatedActionPlans,
              actionPlanMeta: updatedMeta,
            };
          });

          // 5. Trigger sync once
          void runSync().then(() => get().refreshPendingCount());

          return id;
        },

        addActionPlan: (plan) => {
          const id = `PAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newPlan: ActionPlan = {
            ...plan,
            id,
            status: plan.status ?? 'Aberta',
            createdAt: new Date().toISOString().split('T')[0],
            userId: plan.userId ?? get().user?.id,
          };
          set((state) => ({
            actionPlans: [newPlan, ...state.actionPlans],
            actionPlanMeta: { ...state.actionPlanMeta, [id]: { sincronizado: false, pendingDelete: false } },
          }));
          void runSync().then(() => get().refreshPendingCount());
        },

        updateActionPlan: (id, updates) => {
          set((state) => {
            const meta = state.actionPlanMeta[id];
            const newMeta = meta ? { ...meta, sincronizado: false } : { sincronizado: false, pendingDelete: false };
            return {
              actionPlans: state.actionPlans.map((ap) =>
                ap.id === id ? { ...ap, ...updates } : ap,
              ),
              actionPlanMeta: { ...state.actionPlanMeta, [id]: newMeta },
            };
          });
          void runSync().then(() => get().refreshPendingCount());
        },

        deleteActionPlan: (id) => {
          const meta = get().actionPlanMeta[id];
          const isSynced = meta?.sincronizado === true;

          if (isSynced) {
            // Mark as pending delete — the sync will issue a DELETE to Supabase
            set((state) => ({
              actionPlans: state.actionPlans.filter((ap) => ap.id !== id),
              actionPlanMeta: { ...state.actionPlanMeta, [id]: { sincronizado: false, pendingDelete: true } },
            }));
          } else {
            // Not synced — safe to remove entirely
            set((state) => {
              const newMeta = { ...state.actionPlanMeta };
              delete newMeta[id];
              return {
                actionPlans: state.actionPlans.filter((ap) => ap.id !== id),
                actionPlanMeta: newMeta,
              };
            });
          }
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
      version: 2,
      // Persist only the small/user-scoped data. Equipments & inspections
      // now live in Dexie and are loaded via `hydrate()`. `user` is no
      // longer persisted — it is re-derived on each launch from the
      // Supabase session + the `profiles` table (see `resolveSession`).
      partialize: (state) => ({
        actionPlans: state.actionPlans,
        actionPlanMeta: state.actionPlanMeta,
        config: state.config,
        users: state.users,
      }),
      migrate: (persistedState, version) => {
        const base = (persistedState && typeof persistedState === 'object'
          ? persistedState
          : {}) as { actionPlans?: ActionPlan[]; actionPlanMeta?: Record<string, { sincronizado: boolean; pendingDelete: boolean }>; config?: AppConfig; user?: unknown };
        if (version < 2) {
          const { user: _drop, ...rest } = base;
          void _drop;
          return {
            actionPlans: rest.actionPlans ?? [],
            actionPlanMeta: {},
            config: rest.config ?? {
              empresa: 'FireCheck Corp',
              unidade: 'Sede São Paulo',
              offlineMode: false,
              notificationsEnabled: true,
            },
          };
        }
        return {
          actionPlans: base.actionPlans ?? [],
          actionPlanMeta: base.actionPlanMeta ?? {},
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
