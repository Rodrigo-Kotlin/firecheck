import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Equipment, Inspection, Inspector, Stats, ActionPlan, ActionPlanStatus, AppConfig } from '../types';
import { db, type LocalActionPlan, type LocalEquipment, type LocalInspection } from '../db';
import { syncAll, pendingSyncCount } from '../services/sync';
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

type Tab = 'dashboard' | 'equipamentos' | 'qrcodes' | 'inspecionar' | 'relatorios';

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

/** Strip Dexie-only sync metadata so we can store the row in the Zustand state. */
function toEquipment(row: LocalEquipment): Equipment {
  const { sincronizado: _s, pendingDelete: _p, ...eq } = row;
  void _s;
  void _p;
  return eq;
}
function toInspection(row: LocalInspection): Inspection {
  const { sincronizado: _s, pendingDelete: _p, ...insp } = row;
  void _s;
  void _p;
  return insp;
}
function toActionPlan(row: LocalActionPlan): ActionPlan {
  const { sincronizado: _s, pendingDelete: _p, ...plan } = row;
  void _s;
  void _p;
  return plan;
}

/** Generate the next sequential inspection ID (e.g. INSP-007). */
function nextInspectionId(existing: Inspection[]): string {
  const max = existing.reduce((acc, i) => {
    const m = /INSP-(\d+)/.exec(i.id);
    if (!m) return acc;
    const n = Number.parseInt(m[1] ?? '0', 10);
    return n > acc ? n : acc;
  }, 0);
  return `INSP-${String(max + 1).padStart(3, '0')}`;
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
  addInspection: (inspection: Omit<Inspection, 'id'>) => void;
  addEquipment: (eq: Equipment) => void;
  addActionPlan: (plan: Omit<ActionPlan, 'id' | 'createdAt' | 'status'> & { status?: ActionPlanStatus }) => void;
  updateActionPlan: (id: string, updates: Partial<ActionPlan>) => void;
  deleteActionPlan: (id: string) => void;
  deleteEquipment: (id: string) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
  loadUsers: () => Promise<void>;
  setUserRole: (id: string, role: 'admin' | 'inspector') => Promise<void>;
  deleteUserAccount: (id: string) => Promise<void>;
  hydrate: () => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
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
       */
      const runSync = async (): Promise<void> => {
        if (!isSupabaseConfigured) return;
        if (!navigator.onLine) {
          await get().refreshPendingCount();
          return;
        }
        set({ syncing: true });
        try {
          const localActionPlans: LocalActionPlan[] = get().actionPlans.map((p) => ({
            ...p,
            sincronizado: (p as LocalActionPlan).sincronizado ?? true,
            pendingDelete: (p as LocalActionPlan).pendingDelete ?? false,
          }));
          const report = await syncAll(localActionPlans);
          void report;
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
        // Hydration: load from Dexie (seed from mocks on first run) and
        // resolve the current auth session (Supabase getSession + profile).
        // -----------------------------------------------------------------
        hydrate: async () => {
          const [localEqs, localInsps, allUsers] = await Promise.all([
            db.equipamentos.toArray(),
            db.inspecoes.toArray(),
            listUsers(),
          ]);

          set({
            equipments: localEqs.map(toEquipment),
            inspections: localInsps.map(toInspection),
            stats: recomputeStats(localEqs.map(toEquipment)),
          });

          const sessionUser = await resolveSession();
          set({
            user: sessionUser ?? get().user,
            users: allUsers,
            authReady: true,
          });
          await get().refreshPendingCount();
          if (sessionUser) void runSync();
        },

        refreshPendingCount: async () => {
          if (!isSupabaseConfigured) {
            set({ pending: 0 });
            return;
          }
          const cloudPending = await pendingSyncCount();
          const localPending = get().actionPlans.filter(
            (p) => !(p as LocalActionPlan).sincronizado || !!(p as LocalActionPlan).pendingDelete,
          ).length;
          set({ pending: cloudPending + localPending });
        },

        triggerSync: async () => {
          await runSync();
        },

        // -----------------------------------------------------------------
        // Mutations
        // -----------------------------------------------------------------
        addEquipment: (newEq) => {
          const stamped: Equipment = {
            ...newEq,
            createdBy: newEq.createdBy ?? get().user?.id,
          };
          set((state) => {
            const updated = [stamped, ...state.equipments];
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });
          db.equipamentos.put({ ...stamped, sincronizado: false } as LocalEquipment).catch((err) =>
            console.error('[store.addEquipment] erro ao persistir no Dexie:', err),
          );
          void runSync().then(() => get().refreshPendingCount());
        },

        deleteEquipment: (id) => {
          set((state) => {
            const updated = state.equipments.filter((eq) => eq.id !== id);
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });
          void db.equipamentos.delete(id);
          void (async () => {
            const inspections = await db.inspecoes.where('equipmentId').equals(id).toArray();
            for (const insp of inspections) {
              await db.fotos.where('inspectionId').equals(insp.id).delete();
            }
            await db.inspecoes.where('equipmentId').equals(id).delete();
          })();
          void runSync().then(() => get().refreshPendingCount());
        },

        addInspection: (newInspection) => {
          let id = '';
          set((state) => {
            id = nextInspectionId(state.inspections);
            const stamped: Inspection = {
              ...newInspection,
              id,
              userId: newInspection.userId ?? get().user?.id,
            };
            const updatedInspections = [stamped, ...state.inspections];

            const updatedEquipments = state.equipments.map((eq) =>
              eq.id === newInspection.equipmentId
                ? { ...eq, status: newInspection.status }
                : eq,
            );

            let updatedActionPlans = [...state.actionPlans];
            if (newInspection.status === 'vencido' || newInspection.status === 'pendente') {
              const eq = updatedEquipments.find((e) => e.id === newInspection.equipmentId);
              const descObs = newInspection.observacoes || 'Não conformidade identificada durante inspeção';
              const newPlan: LocalActionPlan = {
                id: `PAC-${Date.now()}`,
                equipmentId: newInspection.equipmentId,
                local: eq?.local || 'Local não especificado',
                descricao: descObs,
                criticidade: inferCriticidade(descObs, eq?.tipo || ''),
                responsavel: '',
                prazo: '',
                status: 'Aberta',
                createdAt: new Date().toISOString().split('T')[0],
                userId: get().user?.id,
                sincronizado: false,
              };
              updatedActionPlans = [toActionPlan(newPlan), ...state.actionPlans];
            }

            return {
              inspections: updatedInspections,
              equipments: updatedEquipments,
              actionPlans: updatedActionPlans,
              stats: recomputeStats(updatedEquipments),
            };
          });
          const finalId = id;
          (async () => {
            try {
              const stamped: Inspection = {
                ...newInspection,
                id: finalId,
                userId: newInspection.userId ?? get().user?.id,
              };
              const full: LocalInspection = { ...stamped, sincronizado: false };
              await db.inspecoes.put(full);
              const eq = await db.equipamentos.get(newInspection.equipmentId);
              if (eq) {
                await db.equipamentos.put({
                  ...eq,
                  status: newInspection.status,
                  sincronizado: false,
                });
              }
            } catch (err) {
              console.error('[store.addInspection] erro ao persistir no Dexie:', err);
            }
          })();
          void runSync().then(() => get().refreshPendingCount());
        },

        addActionPlan: (plan) => {
          const newPlan: LocalActionPlan = {
            ...plan,
            id: `PAC-${Date.now()}`,
            status: plan.status ?? 'Aberta',
            createdAt: new Date().toISOString().split('T')[0],
            userId: plan.userId ?? get().user?.id,
            sincronizado: false,
          };
          set((state) => ({ actionPlans: [toActionPlan(newPlan), ...state.actionPlans] }));
          void runSync().then(() => get().refreshPendingCount());
        },

        updateActionPlan: (id, updates) => {
          set((state) => ({
            actionPlans: state.actionPlans.map((ap) =>
              ap.id === id ? ({ ...ap, ...updates, sincronizado: false } as ActionPlan) : ap,
            ),
          }));
          void runSync().then(() => get().refreshPendingCount());
        },

        deleteActionPlan: (id) => {
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
      version: 2,
      // Persist only the small/user-scoped data. Equipments & inspections
      // now live in Dexie and are loaded via `hydrate()`. `user` is no
      // longer persisted — it is re-derived on each launch from the
      // Supabase session + the `profiles` table (see `resolveSession`).
      partialize: (state) => ({
        actionPlans: state.actionPlans,
        config: state.config,
        users: state.users,
      }),
      migrate: (persistedState, version) => {
        const base = (persistedState && typeof persistedState === 'object'
          ? persistedState
          : {}) as { actionPlans?: ActionPlan[]; config?: AppConfig; user?: unknown };
        if (version < 2) {
          const { user: _drop, ...rest } = base;
          void _drop;
          return {
            actionPlans: rest.actionPlans ?? [],
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
