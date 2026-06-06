import Dexie, { type Table } from 'dexie';
import type { Equipment, Inspection, ActionPlan } from '../types';

// ---------------------------------------------------------------------------
// Local storage layer. Mirrors the Supabase schema but is the source of truth
// for offline writes. Every mutable row carries `sincronizado` and
// `pendingDelete` flags so the sync orchestrator can push/purge deltas
// without scanning the entire DB.
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
  }
}

export const db = new FireCheckDatabase();
