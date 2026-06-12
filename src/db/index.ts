import Dexie, { type Table } from 'dexie';
import type { Equipment, Inspection, ActionPlan } from '../types';

// ---------------------------------------------------------------------------
// Local storage layer. Mirrors the Supabase schema but is the source of truth
// for offline writes. Every mutable row carries `sincronizado` and
// `pendingDelete` flags so the sync orchestrator can push/purge deltas
// without scanning the entire DB.
//
// v4 — remove a tabela `users` (auth migrou para Supabase Auth, ver
// 0003_supabase_auth.sql). A `upgrade` apaga qualquer vestígio de sessão
// local legada e força novo login.
// ---------------------------------------------------------------------------

export type PendingActionData = Record<string, unknown>;

export interface PendingAction {
  id?: number;
  type: 'ADD_INSPECTION' | 'ADD_EQUIPMENT';
  data: PendingActionData;
  timestamp: number;
}

export interface PhotoData {
  id?: string; // can be inspectionId
  inspectionId: string;
  base64: string;
}

/** Equipment row as stored in Dexie (adds sync metadata). */
export type LocalEquipment = Equipment & {
  sincronizado: boolean;
  pendingDelete?: boolean;
};

/** Action plan row as stored in Dexie. */
export type LocalActionPlan = ActionPlan & {
  sincronizado: boolean;
  pendingDelete?: boolean;
};

/** Inspection row as stored in Dexie (already had `sincronizado`). */
export type LocalInspection = Inspection & {
  sincronizado: boolean;
  pendingDelete?: boolean;
};

const LEGACY_SESSION_KEY = 'firecheck-auth-session';

export class FireCheckDatabase extends Dexie {
  equipamentos!: Table<LocalEquipment, string>;
  inspecoes!: Table<LocalInspection, string>;
  fotos!: Table<PhotoData, string>;
  acoes_pendentes!: Table<PendingAction, number>;

  constructor() {
    super('FireCheckDatabase');

    // v1 — original schema
    this.version(1).stores({
      equipamentos: 'id, tipo, status',
      inspecoes: 'id, equipmentId, sincronizado',
      fotos: 'id, inspectionId',
      acoes_pendentes: '++id, type, timestamp',
    });

    // v2 — add `sincronizado` index to equipamentos so we can query
    // unsynced rows quickly. The action_plans store lives in the Zustand
    // persist middleware (localStorage), not here.
    this.version(2).stores({
      equipamentos: 'id, tipo, status, sincronizado',
      inspecoes: 'id, equipmentId, sincronizado',
      fotos: 'id, inspectionId',
      acoes_pendentes: '++id, type, timestamp',
    });

    // v3 — local auth. `users` holds registered accounts with a PBKDF2
    // hash + salt.
    this.version(3).stores({
      equipamentos: 'id, tipo, status, sincronizado',
      inspecoes: 'id, equipmentId, sincronizado',
      fotos: 'id, inspectionId',
      acoes_pendentes: '++id, type, timestamp',
      users: 'id, &email, createdAt',
    });

    // v4 — auth migrou para Supabase Auth (0003_supabase_auth.sql).
    // Removemos a tabela `users` e limpamos a sessão legada do localStorage.
    this.version(4)
      .stores({
        equipamentos: 'id, tipo, status, sincronizado',
        inspecoes: 'id, equipmentId, sincronizado',
        fotos: 'id, inspectionId',
        acoes_pendentes: '++id, type, timestamp',
      })
      .upgrade(async (tx) => {
        await tx.table('users').clear().catch(() => undefined);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(LEGACY_SESSION_KEY);
        }
      });
  }

  /** Purge all local data tables. Used when clearing stale cache or
   *  when the user requests "Limpar dados locais deste dispositivo". */
  async clearCache(): Promise<void> {
    await this.transaction('rw',
      this.equipamentos,
      this.inspecoes,
      this.fotos,
      this.acoes_pendentes,
      async () => {
        await this.equipamentos.clear();
        await this.inspecoes.clear();
        await this.fotos.clear();
        await this.acoes_pendentes.clear();
      },
    );
  }
}

export const db = new FireCheckDatabase();
