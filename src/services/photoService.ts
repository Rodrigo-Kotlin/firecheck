/**
 * Photo service — uploads a base64 image to the `inspection-photos` bucket.
 * Falls back silently when Supabase is not configured.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET = 'inspection-photos';

/** Convert a `data:image/jpeg;base64,...` URL into raw bytes. */
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
