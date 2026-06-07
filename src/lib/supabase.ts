/**
 * Supabase client singleton.
 *
 * Credentials are pulled from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * If they're missing or set to the placeholder values from `.env.example`, the
 * client is created in a "disabled" state and the auth service short-circuits.
 *
 * A partir de 0003_supabase_auth.sql, este cliente é a fonte da verdade para
 * identidade. A sessão fica persistida em `localStorage` na chave
 * `firecheck-auth` (renomeada para não colidir com a antiga `firecheck-auth-session`).
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

export const SUPABASE_AUTH_STORAGE_KEY = 'firecheck-auth';

function buildClient(): SupabaseClient | null {
  if (isPlaceholder) return null;
  try {
    return createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
