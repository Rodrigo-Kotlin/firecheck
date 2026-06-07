/**
 * Photo service — handles local compression and cloud upload of inspection
 * photos. Compression is performed on the client via the Canvas API so that
 * we never store the full-resolution camera output in IndexedDB (which would
 * quickly exhaust the per-origin quota). Upload to Supabase is a best-effort
 * fallback when the cloud is configured.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET = 'inspection-photos';

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/** Default longest-edge cap for downscaled photos. Photos smaller than this
 *  in both dimensions are passed through untouched (no upscaling). */
export const PHOTO_MAX_WIDTH = 1280;

/** Default JPEG/WebP quality. 0.8 is a good perceptual/byte trade-off for
 *  document-style evidence photography: artefacts only show under extreme zoom
 *  while keeping the file 3-5× smaller than the camera original. */
export const PHOTO_QUALITY = 0.8;

export type CompressedMime = 'image/jpeg' | 'image/webp';

export interface CompressOptions {
  /** Longest edge in pixels. Defaults to {@link PHOTO_MAX_WIDTH}. */
  maxWidth?: number;
  /** Quality 0..1. Defaults to {@link PHOTO_QUALITY}. */
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
  /** Approximate decoded byte size of the data URL. */
  size: number;
  /** `originalSize / compressedSize`. `1` means no compression, `>1` means
   *  the output is smaller than the input. */
  ratio: number;
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
function readFileAsDataUrl(file: File): Promise<string> {
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
      reject(new Error('Formato de imagem não suportado. Tente JPG, PNG ou HEIC.'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

/**
 * Compress an image file using the Canvas API.
 *
 * Behaviour:
 *  - Always downscales the longest edge to `maxWidth` (default 1280 px). Images
 *    that are already smaller are not upscaled.
 *  - Encodes to `image/webp` when the browser supports it, otherwise falls back
 *    to `image/jpeg`. Both use the same `quality` factor.
 *  - Returns a base64 data URL plus metadata (final dimensions, size, ratio).
 *  - Never throws silently: the returned promise rejects with a user-friendly
 *    Portuguese message suitable for surfacing in a toast or inline banner.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth ?? PHOTO_MAX_WIDTH;
  const quality = options.quality ?? PHOTO_QUALITY;
  const useWebP = (options.preferWebP ?? true) && detectWebPSupport();
  const mimeType: CompressedMime = useWebP ? 'image/webp' : 'image/jpeg';

  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await decodeImage(originalDataUrl);

  // Downscale (only if needed). Preserve aspect ratio.
  let { width, height } = img;
  if (width > maxWidth || height > maxWidth) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxWidth) / width));
      width = maxWidth;
    } else {
      width = Math.max(1, Math.round((width * maxWidth) / height));
      height = maxWidth;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Seu navegador não suporta o processamento de imagem.');
  }
  ctx.drawImage(img, 0, 0, width, height);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL(mimeType, quality);
  } catch (err) {
    // Some browsers throw if the requested MIME is not supported. Fall back
    // to JPEG which has universal support.
    console.warn('[photo.compress] fallback para JPEG:', err);
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  const finalMime: CompressedMime =
    dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';

  const size = Math.round((dataUrl.length * 3) / 4);
  const ratio = file.size > 0 ? file.size / size : 1;

  return { dataUrl, mimeType: finalMime, width, height, size, ratio };
}

// ---------------------------------------------------------------------------
// Upload (best-effort, falls back silently when Supabase isn't configured)
// ---------------------------------------------------------------------------

/** Convert a `data:image/...;base64,...` URL into raw bytes. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+);base64/.exec(meta)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadInspectionPhoto(
  inspectionId: string,
  base64DataUrl: string,
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[photo.upload] Supabase não configurado — foto permanece local.');
    return null;
  }
  try {
    const blob = dataUrlToBlob(base64DataUrl);
    const ext = blob.type.split('/')[1] ?? 'jpg';
    const path = `${inspectionId}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) {
      console.error('[photo.upload]', error);
      return null;
    }
    return path;
  } catch (err) {
    console.error('[photo.upload] exceção:', err);
    return null;
  }
}
