import { db } from '../db';
import type { ChecklistValue, InspectionResult } from '../pages/inspecionar/inspectionWorkflow';

export const INSPECTION_DRAFT_VERSION = 1;

export interface InspectionDraftPhoto {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface InspectionDraft {
  key: string;
  version: number;
  ownerUserId: string;
  equipmentId: string;
  checklist: Record<string, ChecklistValue>;
  deviationNotes: Record<string, string>;
  inspectionResult: InspectionResult;
  inspectorName: string;
  nextInspectionDate: string;
  generalNotes: string;
  photo?: InspectionDraftPhoto;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionDraftLoad {
  draft: InspectionDraft | null;
  invalid: boolean;
}

export function getInspectionDraftKey(ownerUserId: string, equipmentId: string): string {
  return `${ownerUserId}::${equipmentId}`;
}

export function createInspectionDraft(input: Omit<InspectionDraft, 'key' | 'version' | 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): InspectionDraft {
  const now = new Date().toISOString();
  return {
    ...input,
    key: getInspectionDraftKey(input.ownerUserId, input.equipmentId),
    version: INSPECTION_DRAFT_VERSION,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

function isChecklist(value: unknown): value is Record<string, ChecklistValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((item) =>
    item === 'OK' || item === 'ATENCAO' || item === 'REPROVADO' || item === 'N.A.',
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every((item) => typeof item === 'string');
}

function isPhoto(value: unknown): value is InspectionDraftPhoto {
  if (!value || typeof value !== 'object') return false;
  const photo = value as Partial<InspectionDraftPhoto>;
  return photo.blob instanceof Blob
    && typeof photo.mimeType === 'string'
    && typeof photo.width === 'number'
    && typeof photo.height === 'number'
    && typeof photo.sizeBytes === 'number';
}

function isSupportedDraft(value: unknown): value is InspectionDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<InspectionDraft>;
  return draft.version === INSPECTION_DRAFT_VERSION
    && typeof draft.key === 'string'
    && typeof draft.ownerUserId === 'string'
    && typeof draft.equipmentId === 'string'
    && draft.key === getInspectionDraftKey(draft.ownerUserId, draft.equipmentId)
    && isChecklist(draft.checklist)
    && isStringRecord(draft.deviationNotes)
    && typeof draft.inspectionResult === 'string'
    && ['regular', 'observacao', 'vencido'].includes(draft.inspectionResult)
    && typeof draft.inspectorName === 'string'
    && typeof draft.nextInspectionDate === 'string'
    && typeof draft.generalNotes === 'string'
    && (!draft.photo || isPhoto(draft.photo))
    && typeof draft.createdAt === 'string'
    && typeof draft.updatedAt === 'string';
}

export async function saveInspectionDraft(draft: InspectionDraft): Promise<void> {
  if (!isSupportedDraft(draft)) throw new Error('Rascunho inválido.');
  await db.transaction('rw', db.inspectionDrafts, async () => {
    const existing = await db.inspectionDrafts.get(draft.key);
    // A delayed IndexedDB request must never overwrite a newer autosave.
    if (existing && existing.updatedAt > draft.updatedAt) return;
    await db.inspectionDrafts.put(draft);
  });
}

export type InspectionDraftFields = Omit<InspectionDraft, 'key' | 'version' | 'photo'>;

/** Update form fields without structured-cloning the unchanged photo Blob. */
export async function patchInspectionDraft(key: string, fields: InspectionDraftFields): Promise<boolean> {
  return db.transaction('rw', db.inspectionDrafts, async () => {
    const existing = await db.inspectionDrafts.get(key);
    if (!existing || existing.updatedAt > fields.updatedAt) return false;
    await db.inspectionDrafts.update(key, fields);
    return true;
  });
}

export async function loadInspectionDraft(ownerUserId: string, equipmentId: string): Promise<InspectionDraftLoad> {
  if (!ownerUserId || !equipmentId) return { draft: null, invalid: false };
  const raw = await db.inspectionDrafts.get(getInspectionDraftKey(ownerUserId, equipmentId));
  if (!raw) return { draft: null, invalid: false };
  return isSupportedDraft(raw) ? { draft: raw, invalid: false } : { draft: null, invalid: true };
}

export async function deleteInspectionDraft(ownerUserId: string, equipmentId: string): Promise<void> {
  await db.inspectionDrafts.delete(getInspectionDraftKey(ownerUserId, equipmentId));
}

export async function deleteInspectionDraftByKey(key: string): Promise<void> {
  await db.inspectionDrafts.delete(key);
}
