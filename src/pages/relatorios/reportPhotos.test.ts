import { describe, expect, it, vi } from 'vitest';
import type { LocalInspectionPhoto } from '../../db';
import { dedupeResolvedReportPhotos, fitReportImage, getPhotoGridCellLayout, getPhotoGridPosition, inspectionsForReportMonth, resolveInspectionPhotoBlob, sortInspectionPhotos, type ResolvedReportPhoto } from './reportPhotos';

function photo(overrides: Partial<LocalInspectionPhoto> = {}): LocalInspectionPhoto {
  return {
    id: 'PHOTO-1',
    inspectionId: 'INSP-1',
    mimeType: 'image/jpeg',
    sincronizado: true,
    ...overrides,
  };
}

describe('report photo resolution', () => {
  it('maps four photos to a deterministic 2x2 page grid', () => {
    expect([0, 1, 2, 3, 4, 8].map(getPhotoGridPosition)).toEqual([
      { pageIndex: 0, row: 0, column: 0 },
      { pageIndex: 0, row: 0, column: 1 },
      { pageIndex: 0, row: 1, column: 0 },
      { pageIndex: 0, row: 1, column: 1 },
      { pageIndex: 1, row: 0, column: 0 },
      { pageIndex: 2, row: 0, column: 0 },
    ]);
  });

  it.each([
    [1, [1]],
    [2, [2]],
    [3, [3]],
    [4, [4]],
    [5, [4, 1]],
    [8, [4, 4]],
    [9, [4, 4, 1]],
  ])('places %i photos in deterministic page groups', (count, expected) => {
    const groups = Array.from({ length: count }, (_, index) => getPhotoGridPosition(index).pageIndex)
      .reduce<number[]>((result, pageIndex) => {
        result[pageIndex] = (result[pageIndex] ?? 0) + 1;
        return result;
      }, []);
    expect(groups).toEqual(expected);
  });

  it('allocates equal cells and reserves caption space', () => {
    expect(getPhotoGridCellLayout(180, 240)).toEqual({ cellWidth: 87.5, cellHeight: 117.5, imageHeight: 86.95, gap: 5 });
  });

  it('fits vertical and horizontal images without stretching or enlarging', () => {
    expect(fitReportImage(600, 1200, 180, 100)).toEqual({ width: 50, height: 100 });
    expect(fitReportImage(1200, 600, 180, 100)).toEqual({ width: 180, height: 90 });
    expect(fitReportImage(100, 50, 180, 100)).toEqual({ width: 100, height: 50 });
  });

  it('deduplicates evidence by canonical photo id', () => {
    const first = { photo: photo({ id: 'same' }), blob: new Blob(['a']), source: 'local-blob' } as ResolvedReportPhoto;
    const second = { photo: photo({ id: 'same' }), blob: new Blob(['b']), source: 'storage' } as ResolvedReportPhoto;
    const third = { photo: photo({ id: 'other' }), blob: new Blob(['c']), source: 'local-blob' } as ResolvedReportPhoto;
    const seen = new Set<string>();
    expect(dedupeResolvedReportPhotos([first, second, third], seen).map((item) => item.photo.id)).toEqual(['same', 'other']);
  });

  it('scopes monthly inspections by the technical YYYY-MM period', () => {
    expect(inspectionsForReportMonth([
      { id: 'current', data: '2026-10-05' },
      { id: 'old', data: '2026-09-30' },
    ], '2026-10').map((item) => item.id)).toEqual(['current']);
  });

  it('sorts by createdAt and id and excludes soft-deleted rows', () => {
    const result = sortInspectionPhotos([
      photo({ id: 'b', createdAt: '2026-10-01T10:00:00Z' }),
      photo({ id: 'a', createdAt: '2026-10-01T10:00:00Z' }),
      photo({ id: 'deleted', createdAt: '2026-10-01T09:00:00Z', syncAction: 'delete' }),
    ]);
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('prefers a valid local Blob without downloading', async () => {
    const download = vi.fn();
    const result = await resolveInspectionPhotoBlob(photo({ blob: new Blob(['local']) }), download);
    expect(result.source).toBe('local-blob');
    expect(result.blob?.size).toBe(5);
    expect(download).not.toHaveBeenCalled();
  });

  it('uses legacy base64 before Storage', async () => {
    const download = vi.fn();
    const result = await resolveInspectionPhotoBlob(
      photo({ legacyBase64: 'data:image/jpeg;base64, bG9jYWw=' , storagePath: 'remote/path' }),
      download,
    );
    expect(result.source).toBe('legacy-base64');
    expect(download).not.toHaveBeenCalled();
  });

  it('falls back to Storage and caches without changing sync flags', async () => {
    const remote = new Blob(['remote'], { type: 'image/jpeg' });
    const download = vi.fn().mockResolvedValue(remote);
    const cache = vi.fn().mockResolvedValue(undefined);
    const result = await resolveInspectionPhotoBlob(photo({ storagePath: 'remote/path' }), download, cache);
    expect(result.source).toBe('storage');
    expect(result.blob).toBe(remote);
    expect(cache).toHaveBeenCalledWith('PHOTO-1', remote);
  });

  it('returns unavailable when local and remote resolution fail', async () => {
    const result = await resolveInspectionPhotoBlob(
      photo({ storagePath: 'remote/path' }),
      vi.fn().mockRejectedValue(new Error('offline')),
    );
    expect(result.source).toBe('unavailable');
    expect(result.blob).toBeNull();
  });
});
