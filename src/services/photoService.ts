/**
 * Photo service — handles local compression and cloud upload of inspection
 * photos.
 *
 * Compression is performed on the client via the Canvas API so that we never
 * store the full-resolution camera output in IndexedDB (which would quickly
 * exhaust the per-origin quota). Since v6 of the local DB, photos are kept as
 * compressed Blobs (`blob`) instead of base64 strings; rows saved before the
 * migration carry `legacyBase64` and are read transparently during sync.
 *
 * Uploads are performed by the sync orchestrator (`services/sync.ts`) against
 * the `inspection-photos` bucket, storing metadata in `fotos_inspecao`.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const PHOTO_BUCKET = 'inspection-photos';

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/** Default longest-edge cap for downscaled photos. Photos smaller than this in
 *  both dimensions are passed through untouched (no upscaling). */
export const PHOTO_MAX_WIDTH = 1280;

/** Default JPEG/WebP quality. 0.8 is a good perceptual/byte trade-off for
 *  document-style evidence photography. */
export const PHOTO_QUALITY = 0.8;

/** Quality is kept within a safe perceptual band. */
export const PHOTO_MIN_QUALITY = 0.6;
export const PHOTO_MAX_QUALITY = 0.82;

/** Target encoded size — the compression loop stops as soon as the output fits
 *  in this budget. */
export const PHOTO_TARGET_MAX_BYTES = 800 * 1024;

/** Hard limit on the *painted* surface (20–25 MP): bounds the canvas used for
 *  drawing and the final encoded image. It does NOT bound the memory spike of
 *  the initial decode itself — a 48 MP source is still decoded at full
 *  resolution before this cap is applied. Behavior on 48 MP photos must be
 *  validated on a real device. */
export const PHOTO_MAX_MEGAPIXELS = 25;

export type CompressedMime = 'image/jpeg' | 'image/webp';

export interface CompressOptions {
  /** Longest edge in pixels. Defaults to {@link PHOTO_MAX_WIDTH}. */
  maxWidth?: number;
  /** Quality 0..1 (clamped to {@link PHOTO_MIN_QUALITY}..{@link PHOTO_MAX_QUALITY}).
   *  Defaults to {@link PHOTO_QUALITY}. */
  quality?: number;
  /** Prefer WebP when the browser supports it. Defaults to true. */
  preferWebP?: boolean;
}

export interface CompressedImage {
  /** The compressed image as a base64 data URL (`data:image/jpeg;base64,...`
   *  or `data:image/webp;base64,...`). */
  dataUrl: string;
  /** MIME type of the encoded image. */
  mimeType: CompressedMime;
  /** Final width in pixels (after any downscaling). */
  width: number;
  /** Final height in pixels (after any downscaling). */
  height: number;
  /** Byte size of the encoded image. */
  size: number;
  /** `originalSize / compressedSize`. `1` means no compression, `>1` means
   *  the output is smaller than the input. */
  ratio: number;
  /** Original file size in bytes. */
  originalSize: number;
}

/** Result of {@link compressInspectionImage} — a ready-to-persist Blob. */
export interface CompressedInspectionImage {
  /** Compressed image bytes (JPEG/WebP). */
  blob: Blob;
  /** MIME type of the encoded image. */
  mimeType: CompressedMime;
  /** Final width in pixels. */
  width: number;
  /** Final height in pixels. */
  height: number;
  /** Original file size in bytes. */
  originalSize: number;
  /** Byte size of the encoded image. */
  compressedSize: number;
}

/** Detect browser support for `image/webp` via Canvas. Cached on first call
 *  since the result is immutable for the lifetime of the page. */
let webpSupportCache: boolean | null = null;
function detectWebPSupport(): boolean {
  if (webpSupportCache !== null) return webpSupportCache;
  if (typeof document === 'undefined') {
    webpSupportCache = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    webpSupportCache = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupportCache = false;
  }
  return webpSupportCache;
}

/** Read a `File` as a `data:` URL. */
function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Decode a data URL into an `HTMLImageElement`. */
function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () =>
      reject(new Error('Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

/** Encode a canvas to a Blob. */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/** Try the on-screen qualities for a given mime type, keeping the smallest
 *  output that fits the 800 KB target (falling back to the smallest seen). */
async function encodeSmallestWithinBudget(
  canvas: HTMLCanvasElement,
  mime: CompressedMime,
  quality: number,
): Promise<{ blob: Blob | null; best: Blob | null }> {
  const steps = [
    quality,
    Math.max(PHOTO_MIN_QUALITY, quality - 0.08),
    Math.max(PHOTO_MIN_QUALITY, quality - 0.16),
    PHOTO_MIN_QUALITY,
  ];
  let best: Blob | null = null;
  for (const q of steps) {
    const blob = await canvasToBlob(canvas, mime, q);
    if (!blob || blob.type !== mime) continue;
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= PHOTO_TARGET_MAX_BYTES) return { blob, best };
  }
  return { blob: null, best };
}

/** Compress an image file using the Canvas API and return a ready-to-persist
 *  Blob (never a base64 string).
 *
 *  Behaviour:
 *   - Decodes via `createImageBitmap` (with EXIF orientation) when available,
 *     falling back to `HTMLImageElement` otherwise. HEIC is honoured on
 *     platforms that can decode it; it is simply not advertised in the UI.
 *   - Always downscales the longest edge to `maxDimension` (default 1280 px).
 *     Images already smaller are never upscaled. Images above
 *     {@link PHOTO_MAX_MEGAPIXELS} are scaled down proportionally to cap the
 *     painted surface. The initial decode itself may still briefly spike at
 *     the source resolution (see {@link PHOTO_MAX_MEGAPIXELS}).
 *   - Encodes to `image/webp` when supported, otherwise `image/jpeg`.
 *   - Iterates quality steps from {@link PHOTO_QUALITY} down to
 *     {@link PHOTO_MIN_QUALITY} looking for an output ≤ 800 KB.
 *   - Tags dev-builds with byte/dimension/elapsed diagnostics.
 *
 *  Rejects with a user-friendly Portuguese message on any failure.
 */
export async function compressInspectionImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressedInspectionImage> {
  const maxDimension = options.maxWidth ?? PHOTO_MAX_WIDTH;
  const rawQuality = options.quality ?? PHOTO_QUALITY;
  const quality = Math.min(PHOTO_MAX_QUALITY, Math.max(PHOTO_MIN_QUALITY, rawQuality));

  const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;

  const wantWebP = (options.preferWebP ?? true) && detectWebPSupport();
  const requestedMime: CompressedMime = wantWebP ? 'image/webp' : 'image/jpeg';

  // Early reject for formats we know we cannot decode on most devices. Note:
  // createImageBitmap on iOS can still decode HEIC — this only removes the
  // misleading promise from the UI (see photoService docs).
  const ft = file.type.toLowerCase();
  if (ft === 'image/heic' || ft === 'image/heif') {
    throw new Error('Não foi possível processar esta imagem. Use uma foto JPG ou PNG.');
  }

  // -- Decode (createImageBitmap first, HTMLImageElement as fallback) --------
  let bitmap: ImageBitmap | null = null;
  let img: HTMLImageElement | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      img = await decodeImage(dataUrl);
    }
  } catch (err) {
    console.warn('[photo.compress] falha ao decodificar:', err);
    throw new Error('Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.', { cause: err });
  }

  const width = bitmap ? bitmap.width : (img?.naturalWidth ?? 0);
  const height = bitmap ? bitmap.height : (img?.naturalHeight ?? 0);
  if (width <= 0 || height <= 0) {
    throw new Error('Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.');
  }

  try {
    // -- Scale (respect target edge + hard MP cap) ---------------------------
    const megapixels = (width * height) / 1_000_000;
    let scale = Math.min(1, maxDimension / Math.max(width, height));
    if (megapixels > PHOTO_MAX_MEGAPIXELS) {
      scale = Math.min(scale, Math.sqrt(PHOTO_MAX_MEGAPIXELS / megapixels));
    }
    const outWidth = Math.max(1, Math.round(width * scale));
    const outHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Seu navegador não suporta o processamento de imagem.');
    }
    // White backdrop: JPEG has no alpha; avoids black padding around pngs.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outWidth, outHeight);
    if (bitmap) ctx.drawImage(bitmap, 0, 0, outWidth, outHeight);
    else if (img) ctx.drawImage(img, 0, 0, outWidth, outHeight);

    // -- Encode --------------------------------------------------------------
    let blob: Blob;
    let finalMime: CompressedMime;
    const primary = await encodeSmallestWithinBudget(canvas, requestedMime, quality);
    if (primary.blob) {
      blob = primary.blob;
      finalMime = requestedMime;
    } else if (primary.best) {
      blob = primary.best;
      finalMime = requestedMime;
    } else {
      // WebP requested but unsupported at encode time — fall back to JPEG.
      if (requestedMime === 'image/webp') {
        const jpeg = await encodeSmallestWithinBudget(canvas, 'image/jpeg', quality);
        if (jpeg.blob || jpeg.best) {
          blob = jpeg.blob ?? jpeg.best!;
          finalMime = 'image/jpeg';
        } else {
          throw new Error('Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.');
        }
      } else {
        throw new Error('Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.');
      }
    }

    const elapsed = startedAt ? Math.round(performance.now() - startedAt) : 0;
    if (import.meta.env.DEV) {
      console.log(
        `[photo.compress] ${width}×${height} → ${outWidth}×${outHeight} | ` +
          `${file.size} B → ${blob.size} B (${Math.round((1 - blob.size / Math.max(file.size, 1)) * 100)}% menor) | ` +
          `mime=${finalMime} | ${elapsed}ms`,
      );
    }

    return {
      blob,
      mimeType: finalMime,
      width: outWidth,
      height: outHeight,
      originalSize: file.size,
      compressedSize: blob.size,
    };
  } finally {
    bitmap?.close();
  }
}

// ---------------------------------------------------------------------------
// Legacy (base64) helpers — kept for compatibility with data saved pre-v6.
// ---------------------------------------------------------------------------

/** Convert a `data:image/...;base64,...` URL into raw bytes. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+);base64/.exec(meta)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Read a Blob as a base64 data URL (used for previews). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return readFileAsDataUrl(blob);
}

/** Resolve the uploadable bytes for a photo row — prefers the Blob produced by
 *  {@link compressInspectionImage}, falls back to the legacy base64 payload. */
export function getInspectionPhotoBlob(photo: {
  blob?: Blob | null;
  legacyBase64?: string | null;
}): Blob {
  if (photo.blob) return photo.blob;
  if (photo.legacyBase64) return dataUrlToBlob(photo.legacyBase64);
  throw new Error('Foto sem conteúdo local. Não é possível sincronizar.');
}

/** Guess a storage extension from the MIME type. */
export function mimeToExtension(mime: string): string {
  return mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
}

/** Base64-compatible legacy entry point. Kept so existing callers / tests keep
 *  working; new flows should use {@link compressInspectionImage}. */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const result = await compressInspectionImage(file, options);
  const dataUrl = await blobToDataUrl(result.blob);
  return {
    dataUrl,
    mimeType: result.mimeType,
    width: result.width,
    height: result.height,
    size: result.compressedSize,
    ratio: result.originalSize > 0 ? result.originalSize / result.compressedSize : 1,
    originalSize: result.originalSize,
  };
}

// ---------------------------------------------------------------------------
// Upload helpers (used by the sync orchestrator)
// ---------------------------------------------------------------------------

/** Upload an inspection photo object to the `inspection-photos` bucket.
 *  Returns the storage path on success. */
export async function uploadInspectionPhotoBlob(
  path: string,
  blob: Blob,
): Promise<{ ok: boolean; path?: string; error?: { message?: string; code?: string } }> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[photo.upload] Supabase não configurado — foto permanece local.');
    return { ok: false, error: { message: 'Supabase não configurado.' } };
  }
  try {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
      cacheControl: '3600',
    });
    if (error) {
      console.error('[photo.upload]', error);
      return { ok: false, error: { message: error.message, code: error.name } };
    }
    return { ok: true, path };
  } catch (err) {
    console.error('[photo.upload] exceção:', err);
    return { ok: false, error: { message: err instanceof Error ? err.message : 'Erro ao enviar foto.' } };
  }
}

/** Delete a storage object (best-effort). */
export async function removeInspectionPhotoObject(path: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  } catch (err) {
    console.error('[photo.remove] exceção:', err);
  }
}