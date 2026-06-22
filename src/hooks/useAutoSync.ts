import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '../store';
import { isSyncInProgress } from '../services/sync';
import { isSupabaseConfigured } from '../lib/supabase';

const AUTO_SYNC_INTERVAL_MS = 30_000;
const AUTO_SYNC_THROTTLE_MS = 8_000;

function subscribeToOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function useAutoSync() {
  const lastSyncRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useAppStore((s) => s.user);
  const isOnline = useSyncExternalStore(subscribeToOnline, getOnlineSnapshot);

  useEffect(() => {
    if (!user) {
      if (import.meta.env.DEV) console.log('[auto-sync] skipped: no user');
      return;
    }

    const canAutoSync = (): boolean => {
      if (!isSupabaseConfigured) return false;
      if (!navigator.onLine) return false;
      if (isSyncInProgress()) return false;
      return true;
    };

    const shouldThrottle = (): boolean => {
      const now = Date.now();
      return now - lastSyncRef.current < AUTO_SYNC_THROTTLE_MS;
    };

    const triggerAutoSync = (reason: string): void => {
      if (import.meta.env.DEV) console.log(`[auto-sync] trigger: ${reason}`);

      if (!canAutoSync()) {
        if (import.meta.env.DEV) {
          if (isSyncInProgress()) console.log('[auto-sync] skipped: sync in progress');
          else if (!navigator.onLine) console.log('[auto-sync] skipped: offline');
          else if (!isSupabaseConfigured) console.log('[auto-sync] skipped: supabase not configured');
        }
        return;
      }

      if (shouldThrottle()) {
        if (import.meta.env.DEV) {
          const elapsed = Date.now() - lastSyncRef.current;
          console.log(`[auto-sync] skipped: throttled (${elapsed}ms since last)`);
        }
        return;
      }

      if (import.meta.env.DEV) console.log(`[auto-sync] starting sync (reason: ${reason})`);
      lastSyncRef.current = Date.now();
      const store = useAppStore.getState();
      void store.triggerSync();
    };

    if (import.meta.env.DEV) console.log('[auto-sync] mounted');

    const handleFocus = () => triggerAutoSync('focus');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') triggerAutoSync('visibility');
    };
    const handleOnline = () => triggerAutoSync('online');

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    intervalRef.current = setInterval(() => triggerAutoSync('interval'), AUTO_SYNC_INTERVAL_MS);

    triggerAutoSync('mount');

    return () => {
      if (import.meta.env.DEV) console.log('[auto-sync] unmounted');
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, isOnline]);
}
