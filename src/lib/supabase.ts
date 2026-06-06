/**
 * Supabase client singleton.
 *
 * Credentials are pulled from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * If they're missing or set to the placeholder values from `.env.example`, the
 * client is created in a "disabled" state — all sync calls will short-circuit so
 * the rest of the app can keep running against Dexie / localStorage only.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isPlaceholder =
  !url ||
  !anonKey ||
  url.includes('YOUR-PROJECT-REF') ||
  anonKey.includes('YOUR-ANON');

export const isSupabaseConfigured = !isPlaceholder;

function buildClient(): SupabaseClient | null {
  if (isPlaceholder) return null;
  try {
    return createClient(url!, anonKey!, {
      auth: {
        // We keep the mock login but still configure persistence so that
        // service-worker or future real-auth flows work seamlessly.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-application-name': 'firecheck-pwa' },
      },
    });
  } catch (err) {
    console.error('[supabase] Failed to initialise client:', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = buildClient();

if (isPlaceholder) {
  console.warn(
    '[supabase] Credenciais não configuradas (.env). O app rodará em modo 100% offline (Dexie + localStorage).'
  );
}
