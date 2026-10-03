import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, unknown>());
const draftTable = vi.hoisted(() => ({
  get: async (key: string) => memory.get(key),
  put: async (value: { key: string }) => { memory.set(value.key, value); },
  delete: async (key: string) => { memory.delete(key); },
  clear: async () => { memory.clear(); },
}));
const fakeDb = vi.hoisted(() => ({
  inspectionDrafts: draftTable,
  transaction: async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
}));

vi.mock('../db', () => ({ db: fakeDb }));

import {
  createInspectionDraft,
  deleteInspectionDraft,
  getInspectionDraftKey,
  loadInspectionDraft,
  saveInspectionDraft,
} from './inspectionDraftService';

function draft(ownerUserId = 'user-a', equipmentId = 'EXT-001', overrides: Record<string, unknown> = {}) {
  return createInspectionDraft({
    ownerUserId,
    equipmentId,
    checklist: { 'Lacre íntegro': 'OK' },
    deviationNotes: {},
    inspectionResult: 'regular',
    inspectorName: 'Inspetor A',
    nextInspectionDate: '2026-12-01',
    generalNotes: '',
    ...overrides,
  });
}

describe('inspection draft repository', () => {
  beforeEach(() => memory.clear());

  it('saves and loads by owner plus equipment', async () => {
    const value = draft();
    await saveInspectionDraft(value);
    await expect(loadInspectionDraft('user-a', 'EXT-001')).resolves.toEqual({ draft: value, invalid: false });
  });

  it('isolates users and equipment', async () => {
    await saveInspectionDraft(draft('user-a', 'EXT-001'));
    await expect(loadInspectionDraft('user-b', 'EXT-001')).resolves.toEqual({ draft: null, invalid: false });
    await expect(loadInspectionDraft('user-a', 'EXT-002')).resolves.toEqual({ draft: null, invalid: false });
  });

  it('updates the same owner/equipment draft instead of creating another one', async () => {
    await saveInspectionDraft(draft());
    const updated = draft('user-a', 'EXT-001', { generalNotes: 'Atualizado', updatedAt: '2027-01-02T00:00:00.000Z' });
    await saveInspectionDraft(updated);
    expect(memory.size).toBe(1);
    await expect(loadInspectionDraft('user-a', 'EXT-001')).resolves.toEqual({ draft: updated, invalid: false });
  });

  it('deletes only the selected draft', async () => {
    await saveInspectionDraft(draft('user-a', 'EXT-001'));
    await saveInspectionDraft(draft('user-a', 'EXT-002'));
    await deleteInspectionDraft('user-a', 'EXT-001');
    expect(memory.has(getInspectionDraftKey('user-a', 'EXT-001'))).toBe(false);
    expect(memory.has(getInspectionDraftKey('user-a', 'EXT-002'))).toBe(true);
  });

  it('preserves the processed photo Blob and metadata', async () => {
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const value = draft('user-a', 'EXT-001', {
      photo: { blob, mimeType: 'image/jpeg', width: 1280, height: 720, sizeBytes: blob.size },
    });
    await saveInspectionDraft(value);
    const loaded = (await loadInspectionDraft('user-a', 'EXT-001')).draft;
    expect(loaded?.photo?.blob).toBe(blob);
    expect(loaded?.photo?.sizeBytes).toBe(blob.size);
  });

  it('rejects unsupported draft versions without exposing partial data', async () => {
    memory.set(getInspectionDraftKey('user-a', 'EXT-001'), { ...draft(), version: 99 });
    await expect(loadInspectionDraft('user-a', 'EXT-001')).resolves.toEqual({ draft: null, invalid: true });
  });

  it('does not allow an older save to overwrite a newer one', async () => {
    const newer = draft('user-a', 'EXT-001', { updatedAt: '2026-02-01T00:00:00.000Z', generalNotes: 'novo' });
    const older = draft('user-a', 'EXT-001', { updatedAt: '2026-01-01T00:00:00.000Z', generalNotes: 'antigo' });
    await saveInspectionDraft(newer);
    await saveInspectionDraft(older);
    await expect(loadInspectionDraft('user-a', 'EXT-001')).resolves.toEqual({ draft: newer, invalid: false });
  });
});
