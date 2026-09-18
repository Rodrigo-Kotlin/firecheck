/**
 * Circuit breaker + backoff progressivo da sincronização.
 *
 * `navigator.onLine` é apenas o SINAL INICIAL: ele diz "link está de pé", não
 * "backend alcançável". A indisponibilidade real é comprovada por uma chamada
 * ao Supabase que falha com erro de rede (isNetworkUnavailableError).
 *
 * Este módulo é a FONTE ÚNICA da decisão "podemos tentar a rede?":
 *
 *   canAttemptNetwork() — browser online + Supabase configurado + fora do
 *                         cooldown (ou pronto para uma tentativa controlada).
 *
 * Estados conceituais:
 *   healthy  — última tentativa confirmou o backend (backendReachable=true).
 *   offline  — browser reportou offline explicitamente (navigator.onLine=false).
 *   cooldown — backend inalcançável; tentativas suspensas até retryAt.
 *
 * Eventos:
 *   window.offline → abre o breaker imediatamente (nenhuma chamada remota).
 *   window.online  → libera UMA tentativa controlada; o breaker só reabre se
 *                    essa tentativa falhar por rede de novo.
 *
 * Backoff (progressivo, com teto): 15s → 30s → 60s → 120s → 300s (máx).
 */
import { isSupabaseConfigured } from '../lib/supabase';

const BACKOFF_STEPS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

/** Otimista até ser provado o contrário. */
let backendReachable = true;
let failureCount = 0;
/** Timestamp em que a próxima tentativa é permitida (null = sem cooldown). */
let retryAt: number | null = null;

let listenersRegistered = false;

function log(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log('[network]', ...args);
}

export type NetworkState = 'healthy' | 'offline' | 'cooldown';

export function getBackendReachable(): boolean {
  return backendReachable;
}

export function getNetworkRetryAt(): number | null {
  return retryAt;
}

function backoffMs(): number {
  const idx = Math.min(Math.max(failureCount, 1), BACKOFF_STEPS_MS.length) - 1;
  return BACKOFF_STEPS_MS[idx];
}

export function getNetworkState(): NetworkState {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  if (!backendReachable) return 'cooldown';
  return 'healthy';
}

export function canAttemptNetwork(): boolean {
  if (!isSupabaseConfigured) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (backendReachable) return true;
  // Backend inalcançável: permite tentativa assim que o cooldown expirar
  // (ou quando o browser disparar `online` e limpar o cooldown).
  if (retryAt === null) return true;
  return Date.now() >= retryAt;
}

/** Browser reportou offline — marcar imediatamente e não tentar nada remoto. */
export function markBrowserOffline(): void {
  backendReachable = false;
  retryAt = null;
  if (import.meta.env.DEV) log('browser offline — suspenso até evento online');
}

/** Browser voltou online — libera UMA tentativa controlada. */
export function clearCooldown(): void {
  if (backendReachable && retryAt === null) return;
  retryAt = null;
  if (import.meta.env.DEV) log('cooldown liberado — tentativa controlada permitida');
}

/** Uma falha real de rede foi comprovada: abre o breaker e agenda o retry. */
export function markNetworkFailure(): void {
  failureCount++;
  backendReachable = false;
  retryAt = Date.now() + backoffMs();
  if (import.meta.env.DEV) {
    console.log('[network] backend unreachable');
    console.log(`[network] retry suspended for ${backoffMs()} ms (falha #${failureCount})`);
  }
}

/** O backend respondeu: fecha o breaker e zera o backoff. */
export function markNetworkSuccess(): void {
  const wasOpen = !backendReachable || failureCount > 0;
  failureCount = 0;
  backendReachable = true;
  retryAt = null;
  if (wasOpen && import.meta.env.DEV) log('connectivity restored');
}

/** Registra os listeners globais de conectividade (idempotente). */
export function ensureNetworkListeners(): void {
  if (listenersRegistered) return;
  if (typeof window === 'undefined') return;
  listenersRegistered = true;
  window.addEventListener('offline', () => markBrowserOffline());
  window.addEventListener('online', () => clearCooldown());
}