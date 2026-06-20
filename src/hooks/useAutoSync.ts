import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { isSyncInProgress } from '../services/sync';
import { isSupabaseConfigured } from '../lib/supabase';

const AUTO_SYNC_INTERVAL_MS = 60_000;
const THROTTLE_MS = 10_000;

export function useAutoSync() {
  const lastSyncRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useAppStore((s) => s.user);
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  useEffect(() => {
    if (!user) return;

    const canAutoSync = () => {
      if (!isSupabaseConfigured) return false;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
      if (isSyncInProgress()) return false;
      return true;
    };

    const shouldThrottle = () => {
      const now = Date.now();
      if (now - lastSyncRef.current < THROTTLE_MS) return true;
      return false;
    };

    const doSync = (source: string) => {
      if (shouldThrottle()) {
        if (import.meta.env.DEV) console.log(`[auto-sync] sync ignorado por throttle (${source})`);
        return;
      }
      if (!canAutoSync()) {
        if (import.meta.env.DEV) {
          if (isSyncInProgress()) console.log('[auto-sync] sync ignorado — já em andamento');
          else if (!navigator.onLine) console.log('[auto-sync] sync ignorado — offline');
          else if (!isSupabaseConfigured) console.log('[auto-sync] sync ignorado — Supabase não configurado');
        }
        return;
      }
      if (import.meta.env.DEV) console.log(`[auto-sync] sincronizando por ${source}`);
      lastSyncRef.current = Date.now();
      void useAppStore.getState().triggerSync();
    };

    const handleFocus = () => doSync('focus');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') doSync('visibility');
    };
    const handleOnline = () => doSync('online');

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    intervalRef.current = setInterval(() => doSync('interval'), AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, isOnline]);
}
