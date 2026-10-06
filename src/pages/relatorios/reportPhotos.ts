import { db, type LocalInspectionPhoto } from '../../db';
import { downloadInspectionPhoto, getInspectionPhotoBlob } from '../../services/photoService';

export type ResolvedReportPhoto = {
  photo: LocalInspectionPhoto;
  blob: Blob | null;
  source: 'local-blob' | 'legacy-base64' | 'storage' | 'unavailable';
};

export function fitReportImage(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / Math.max(width, 1), maxHeight / Math.max(height, 1), 1);
  return { width: width * scale, height: height * scale };
}

export function dedupeResolvedReportPhotos(
  photos: ResolvedReportPhoto[],
  seenPhotoIds: Set<string>,
): ResolvedReportPhoto[] {
  return photos.filter(({ photo }) => {
    if (seenPhotoIds.has(photo.id)) return false;
    seenPhotoIds.add(photo.id);
    return true;
  });
}

type DownloadPhoto = (storagePath: string) => Promise<Blob | null>;
type CachePhoto = (id: string, blob: Blob) => Promise<unknown>;

function isDeleted(photo: LocalInspectionPhoto): boolean {
  const candidate = photo as LocalInspectionPhoto & { deletedAt?: string | null; pendingDelete?: boolean };
  return candidate.deletedAt != null || candidate.pendingDelete === true || photo.syncAction === 'delete';
}

export function sortInspectionPhotos(photos: LocalInspectionPhoto[]): LocalInspectionPhoto[] {
  return photos
    .filter((photo) => !isDeleted(photo))
    .sort((left, right) => {
      const createdAt = (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
      return createdAt !== 0 ? createdAt : left.id.localeCompare(right.id);
    });
}

export function inspectionsForReportMonth<T extends { data: string }>(inspections: T[], monthKey: string): T[] {
  return inspections.filter((inspection) => inspection.data.slice(0, 7) === monthKey);
}

export async function getInspectionPhotos(inspectionId: string): Promise<LocalInspectionPhoto[]> {
  try {
    const photos = await db.fotos.where('inspectionId').equals(inspectionId).toArray();
    return sortInspectionPhotos(photos);
  } catch (error) {
    console.error('[reports.photos]', inspectionId, error);
    return [];
  }
}

export async function resolveInspectionPhotoBlob(
  photo: LocalInspectionPhoto,
  download: DownloadPhoto = downloadInspectionPhoto,
  cache: CachePhoto = (id, blob) => db.fotos.update(id, { blob }),
): Promise<ResolvedReportPhoto> {
  if (photo.blob && photo.blob.size > 0) {
    return { photo, blob: photo.blob, source: 'local-blob' };
  }

  if (photo.legacyBase64) {
    try {
      const blob = getInspectionPhotoBlob({ blob: undefined, legacyBase64: photo.legacyBase64 });
      if (blob.size > 0) return { photo, blob, source: 'legacy-base64' };
    } catch {
      // A malformed legacy value may still have a valid remote fallback.
    }
  }

  if (photo.storagePath) {
    try {
      const blob = await download(photo.storagePath);
      if (blob && blob.size > 0) {
        try {
          await cache(photo.id, blob);
        } catch {
          // Caching is best-effort; the report can use this download now.
        }
        return { photo, blob, source: 'storage' };
      }
    } catch {
      // One unavailable photo must not abort the report.
    }
  }

  return { photo, blob: null, source: 'unavailable' };
}

export async function resolveInspectionPhotos(inspectionId: string): Promise<ResolvedReportPhoto[]> {
  const photos = await getInspectionPhotos(inspectionId);
  const resolved: ResolvedReportPhoto[] = [];
  for (const photo of photos) {
    resolved.push(await resolveInspectionPhotoBlob(photo));
  }
  return resolved;
}

export async function resolveInspectionPhotosForInspections(
  inspections: Array<{ id: string }>,
): Promise<Map<string, ResolvedReportPhoto[]>> {
  const resolved = new Map<string, ResolvedReportPhoto[]>();
  const seenPhotoIds = new Set<string>();

  for (const inspection of inspections) {
    const photos = await resolveInspectionPhotos(inspection.id);
    const uniquePhotos = dedupeResolvedReportPhotos(photos, seenPhotoIds);
    if (uniquePhotos.length > 0) resolved.set(inspection.id, uniquePhotos);
  }

  return resolved;
}
