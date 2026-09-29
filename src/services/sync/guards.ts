import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { canAttemptNetwork } from '../networkState';
import { type SyncReport } from './types';

export function ownsPending(
  row: { syncOwnerUserId?: string },
  userId: string | undefined,
  domain: string,
  id: string,
): boolean {
  if (row.syncOwnerUserId === userId && !!userId) return true;
  if (import.meta.env.DEV && !row.syncOwnerUserId) {
    console.warn(`[sync] legacy-unowned-pending skipped: ${domain}/${id}`);
  }
  return false;
}

export function skip(reason: string): SyncReport {
  return {
    pushed: 0, pulled: 0, deleted: 0, errors: 0, skipped: true, reason, networkUnavailable: false,
    pushEqOk: 0, pushInsOk: 0, pushErrors: 0,
    pullEqImported: 0, pullEqReconciled: 0,
    pullInsImported: 0, pullInsReconciled: 0,
    pullEqError: false, pullInsError: false,
    pullEqEmpty: false, pullInsEmpty: false,
    pushApOk: 0, pushApErrors: 0,
    pullApImported: 0, pullApReconciled: 0,
    pullApError: false, pullApEmpty: false,
    pushPhotoOk: 0, pushPhotoErrors: 0, pushPhotoSkipped: 0,
    pullPhotoImported: 0, pullPhotoReconciled: 0,
    pullPhotoError: false, pullPhotoEmpty: false,
  };
}

export function canSync(): string | null {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  if (!isSupabaseConfigured || !supabase) return 'supabase-not-configured';
  if (!canAttemptNetwork()) return 'network-cooldown';
  return null;
}

export function isConflict(localBase: string | null | undefined, remoteUpdatedAt: string | undefined): boolean {
  if (!localBase || !remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() !== new Date(localBase).getTime();
}
