import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Equipment, Inspection, Inspector, Stats, ActionPlan, ActionPlanStatus, AppConfig } from '../types';
import { equipamentos, inspecoes, estatisticas } from '../data/mock';
import { db, type LocalActionPlan, type LocalEquipment, type LocalInspection } from '../db';
import { syncAll, pendingSyncCount, seedFromMock, type SyncReport } from '../services/sync';
import { isSupabaseConfigured } from '../lib/supabase';
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

type Tab = 'dashboard' | 'equipamentos' | 'inspecionar' | 'relatorios';

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
  const vencidos = eqs.filter((e) => e.status === 'vencido').length;
  const observacao = eqs.filter((e) => e.status === 'observacao').length;
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
  lastSync: SyncReport | null;
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
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
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
          set({ lastSync: report, lastSyncAt: Date.now() });
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
        equipments: equipamentos,
        inspections: inspecoes,
        stats: estatisticas,
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
        lastSync: null,
        pending: 0,
        lastSyncAt: null,
        syncEnabled: isSupabaseConfigured,

        // -----------------------------------------------------------------
        // Auth — local-first, backed by Dexie + Web Crypto (PBKDF2).
        // -----------------------------------------------------------------
        login: async (email, pass) => {
          set({ authLoading: true });
          try {
            const user = await loginUser({ email, password: pass });
            set({ user, authLoading: false });
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
        // resolve the current auth session (with orphan cleanup).
        // -----------------------------------------------------------------
        hydrate: async () => {
          const eqCount = await db.equipamentos.count();
          if (eqCount === 0) {
            await seedFromMock(equipamentos, inspecoes);
          }
          const [localEqs, localInsps, allUsers] = await Promise.all([
            db.equipamentos.toArray(),
            db.inspecoes.toArray(),
            listUsers(),
          ]);
          // Resolve auth: if the persisted user no longer exists in the
          // `users` table (e.g. legacy mock-login state), drop them.
          const sessionUser = await resolveSession();

          set({
            equipments: localEqs.map(toEquipment),
            inspections: localInsps.map(toInspection),
            stats: recomputeStats(localEqs.map(toEquipment)),
            user: sessionUser ?? get().user,
            users: allUsers,
            authReady: true,
          });
          await get().refreshPendingCount();
          // Try an initial sync in the background.
          void runSync();
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
          // Stamp ownership on the equipment itself (idempotent — the form
          // may already set it, this is a defensive fallback).
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
          // Persist + mark unsynced
          void db.equipamentos.put({ ...stamped, sincronizado: false } as LocalEquipment);
          void runSync().then(() => get().refreshPendingCount());
        },

        updateEquipment: (id, updates) => {
          set((state) => {
            const updated = state.equipments.map((eq) =>
              eq.id === id ? { ...eq, ...updates } : eq,
            );
            return {
              equipments: updated,
              stats: recomputeStats(updated),
            };
          });
          const current = get().equipments.find((e) => e.id === id);
          if (current) {
            void db.equipamentos.put({ ...current, sincronizado: false } as LocalEquipment);
          }
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
          // Cascade: remove the equipment's inspections and pending photos.
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
          // Persist to Dexie (inspection + the updated equipment status)
          const finalId = id;
          void (async () => {
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
          // For Dexie/Supabase deletes: only the cloud-side plan with that ID
          // needs to be removed. Action plans live in localStorage, so we
          // additionally push a delete to the cloud via syncAll's `pendingDelete`
          // mechanism. The simplest path is to mark a sentinel that syncAll
          // understands; since our syncAll uses the array passed in, we just
          // need to make sure that array reflects the deletion.
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
            // The admin can't delete their own account from this screen.
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
      // longer persisted — it is re-derived on each launch from the auth
      // session in localStorage + the `users` table in Dexie (see
      // `resolveSession`). `authReady` and `authLoading` are transient
      // and must always be re-derived on each launch.
      partialize: (state) => ({
        actionPlans: state.actionPlans,
        config: state.config,
        // `users` is intentionally persisted as well so the admin panel
        // renders instantly on reload, before the (async) reload finishes.
        // No sensitive data — passwords never live in this projection.
        users: state.users,
      }),
      // Bump-version migration: strip the legacy `user` field that was
      // persisted by the mock login. Real user identity now lives in
      // the auth session + Dexie users table.
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
