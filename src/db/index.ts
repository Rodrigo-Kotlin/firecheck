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

/** Inspection photo row as stored in Dexie.
 *
 *  v6+: the compressed image lives in `blob` (a Blob, not base64). Rows
 *  created before the v6 migration keep their payload in `legacyBase64` and
 *  are read transparently during sync via `getInspectionPhotoBlob()`. */
export interface LocalInspectionPhoto {
  /** Local photo id (uuid). */
  id: string;
  inspectionId: string;
  /** Compressed image bytes (JPEG/WebP). Preferred over `legacyBase64`. */
  blob?: Blob;
  /** Legacy payload — base64 data URL saved before the v6 schema. */
  legacyBase64?: string;
  /** MIME type of the encoded image. */
  mimeType: string;
  width?: number;
  height?: number;
  /** Byte size of the encoded image. */
  size?: number;
  /** true once the photo is confirmed remote (storage + `fotos_inspecao`). */
  sincronizado: boolean;
  /** Intenção da operação pendente: 'create' (default) | 'delete'. */
  syncAction?: 'create' | 'delete';
  /** Erro persistente da última tentativa de sync. */
  syncError?: string;
  /** Caminho no bucket `inspection-photos` após upload bem-sucedido. */
  storagePath?: string;
  /** id da linha correspondente em `fotos_inspecao` (mesmo valor local). */
  remoteId?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Conta que criou a mutation local pendente; nunca vai para Supabase. */
  syncOwnerUserId?: string;
}

/** Equipment row as stored in Dexie (adds sync metadata). */
export type LocalEquipment = Equipment & {
  sincronizado: boolean;
  pendingDelete?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Indica a intenção da operação pendente: 'create' | 'update' | 'delete'. */
  syncAction?: 'create' | 'update' | 'delete';
  /** Erro persistente da última tentativa de sync (ex.: 'duplicate'). Não apaga o registro. */
  syncError?: string;
  /** Indica que o status foi alterado por uma inspeção e deve ser sincronizado
   *  via RPC em pushInspections(), não via pushEquipments(). */
  statusUpdatePending?: boolean;
  /** Valor de updatedAt remoto conhecido no momento em que o registro foi
   *  carregado ou sincronizado pela última vez. Usado para detectar conflito. */
  syncBaseUpdatedAt?: string | null;
  /** Indica que o registro local tentou sincronizar, mas o remoto mudou
   *  desde a última versão base conhecida. */
  syncConflict?: boolean;
  /** Mensagem técnica/amigável do conflito. */
  syncConflictReason?: string | null;
  /** Valor remoto de updatedAt no momento em que o conflito foi detectado. */
  remoteUpdatedAtAtConflict?: string | null;
  /** Conta que criou a mutation local pendente; nunca vai para Supabase. */
  syncOwnerUserId?: string;
};

/** Action plan row as stored in Dexie (adds sync metadata). */
export type LocalActionPlan = ActionPlan & {
  sincronizado: boolean;
  pendingDelete?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  updatedAt?: string;
  /** Indica a intenção da operação pendente: 'create' | 'update' | 'delete'. */
  syncAction?: 'create' | 'update' | 'delete';
  /** Erro persistente da última tentativa de sync. */
  syncError?: string;
  /** Valor de updatedAt remoto conhecido no momento em que o registro foi
   *  carregado ou sincronizado pela última vez. Usado para detectar conflito. */
  syncBaseUpdatedAt?: string | null;
  /** Indica que o registro local tentou sincronizar, mas o remoto mudou
   *  desde a última versão base conhecida. */
  syncConflict?: boolean;
  /** Mensagem técnica/amigável do conflito. */
  syncConflictReason?: string | null;
  /** Valor remoto de updatedAt no momento em que o conflito foi detectado. */
  remoteUpdatedAtAtConflict?: string | null;
  /** Conta que criou a mutation local pendente; nunca vai para Supabase. */
  syncOwnerUserId?: string;
};

/** Inspection row as stored in Dexie (adds sync metadata + audit fields). */
export type LocalInspection = Inspection & {
  sincronizado: boolean;
  pendingDelete?: boolean;
  /** Intenção da operação local pendente: 'create' | 'update' | 'delete'. */
  syncAction?: 'create' | 'update' | 'delete';
  /** Valor de updatedAt remoto conhecido no momento em que a inspeção foi
   *  carregada ou sincronizada pela última vez. Base do CAS. */
  syncBaseUpdatedAt?: string | null;
  /** Indica que a edição local tentou sincronizar, mas o remoto mudou. */
  syncConflict?: boolean;
  /** Mensagem técnica/amigável do conflito. */
  syncConflictReason?: string | null;
  /** Valor remoto de updatedAt no momento em que o conflito foi detectado. */
  remoteUpdatedAtAtConflict?: string | null;
  /** Erro persistente da última tentativa de sync. */
  syncError?: string;
  /** Timestamp local da última edição. */
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  /** Conta que criou a mutation local pendente; nunca vai para Supabase. */
  syncOwnerUserId?: string;
};

const LEGACY_SESSION_KEY = 'firecheck-auth-session';

export class FireCheckDatabase extends Dexie {
  equipamentos!: Table<LocalEquipment, string>;
  inspecoes!: Table<LocalInspection, string>;
  planosAcao!: Table<LocalActionPlan, string>;
  fotos!: Table<LocalInspectionPhoto, string>;
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

    // v5 — add planosAcao table to IndexedDB. Previously action plans lived
    // only in Zustand/localStorage; now they join the offline-first Dexie
    // model alongside equipments and inspections.
    this.version(5).stores({
      equipamentos: 'id, tipo, status, sincronizado',
      inspecoes: 'id, equipmentId, sincronizado',
      planosAcao: 'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt',
      fotos: 'id, inspectionId',
      acoes_pendentes: '++id, type, timestamp',
    });

    // v6 — fotos de inspeção passam a guardar Blobs comprimidos (JPEG/WebP)
    // em vez de base64, e ganham metadados de sincronização (sincronizado,
    // syncAction, storagePath). Fotos antigas são migradas para `legacyBase64`
    // e marcadas como pendentes de sync — o push reaproveita o payload antigo.
    this.version(6)
      .stores({
        equipamentos: 'id, tipo, status, sincronizado',
        inspecoes: 'id, equipmentId, sincronizado',
        planosAcao: 'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt',
        fotos: 'id, inspectionId, sincronizado, syncAction, storagePath',
        acoes_pendentes: '++id, type, timestamp',
      })
      .upgrade(async (tx) => {
        const fotosTable = tx.table('fotos');
        const rows = await fotosTable.toArray();
        for (const row of rows) {
          const legacy = row.legacyBase64 ?? row.base64;
          if (typeof legacy !== 'string' || legacy.length === 0) continue;
          const mime = /^data:([^;]+);/.exec(legacy)?.[1] ?? 'image/jpeg';
          const approxSize = Math.round((legacy.length * 3) / 4);
          await fotosTable.update(row.id as string, {
            legacyBase64: legacy,
            mimeType: mime,
            size: approxSize,
            sincronizado: false,
            syncAction: 'create',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            base64: undefined,
          });
        }
      });

    // v7 — inspeções ganham índices de sincronização (syncAction, syncConflict,
    // updatedAt). Não há upgrade destrutivo: os dados existentes são
    // preservados e apenas os novos índices são criados.
    this.version(7).stores({
      equipamentos: 'id, tipo, status, sincronizado',
      inspecoes: 'id, equipmentId, sincronizado, syncAction, syncConflict, updatedAt',
      planosAcao: 'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt',
      fotos: 'id, inspectionId, sincronizado, syncAction, storagePath',
      acoes_pendentes: '++id, type, timestamp',
    });

    // v8 — ownership local das mutations pendentes. A migration só adiciona
    // índices e preserva integralmente rows, Blobs, tombstones e conflitos.
    this.version(8).stores({
      equipamentos: 'id, tipo, status, sincronizado, syncOwnerUserId',
      inspecoes: 'id, equipmentId, sincronizado, syncAction, syncConflict, updatedAt, syncOwnerUserId',
      planosAcao: 'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt, syncOwnerUserId',
      fotos: 'id, inspectionId, sincronizado, syncAction, storagePath, syncOwnerUserId',
      acoes_pendentes: '++id, type, timestamp',
    });
  }

  /** Purge all local data tables. Used when clearing stale cache or
   *  when the user requests "Limpar dados locais deste dispositivo". */
  async clearCache(): Promise<void> {
    await this.transaction('rw',
      [this.equipamentos, this.inspecoes, this.planosAcao, this.fotos, this.acoes_pendentes],
      async () => {
        await this.equipamentos.clear();
        await this.inspecoes.clear();
        await this.planosAcao.clear();
        await this.fotos.clear();
        await this.acoes_pendentes.clear();
      },
    );
  }
}

export const db = new FireCheckDatabase();
