import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// usePwaInstall — captures the browser's deferred install prompt and exposes
// a safe API for triggering it from the UI. Three states are surfaced:
//
//   'unavailable' — browser has no install surface (or it has dismissed the
//                   prompt and we are not on iOS). Show fallback instructions.
//   'available'   — `beforeinstallprompt` has fired and is queued. The user
//                   can be offered a one-tap "Adicionar à tela inicial" CTA.
//   'installed'   — the app is already running as a standalone PWA.
//
// iOS Safari never fires `beforeinstallprompt`. We detect it via UA + the
// `navigator.standalone` flag so we can show manual "Share → Add to Home
// Screen" instructions instead of a dead button.
// ---------------------------------------------------------------------------

// `BeforeInstallPromptEvent` is a non-standard DOM type; declare just what we
// use so we don't depend on lib.dom evolving.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallState = 'unavailable' | 'available' | 'installed';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'error';

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as Mac, so also check for touch points.
  const isIpad = ua.includes('iPad') || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  return /iPad|iPhone|iPod/.test(ua) || isIpad;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mql?.matches) || iosStandalone;
}

export function usePwaInstall() {
  // Compute initial state lazily so we don't trigger a cascading render by
  // calling setState in a mount effect (detection only reads from `navigator`
  // and `window.matchMedia`, which are stable for the lifetime of the page).
  const [isIos] = useState<boolean>(() => detectIos());
  const [state, setState] = useState<InstallState>(() =>
    detectStandalone() ? 'installed' : 'unavailable'
  );
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome from showing its own mini-infobar.
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setState('available');
    };
    const onAppInstalled = () => {
      setPromptEvent(null);
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!promptEvent) return 'unavailable';
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      // The event can only be used once; drop it regardless of outcome.
      setPromptEvent(null);
      if (choice.outcome === 'accepted') {
        setState('installed');
        return 'accepted';
      }
      // User dismissed — keep "available" so the button reappears if they
      // want to try again later. Browser may or may not re-fire the event.
      return 'dismissed';
    } catch (err) {
      console.warn('[pwa] Falha ao exibir prompt de instalação:', err);
      return 'error';
    }
  }, [promptEvent]);

  return { state, isIos, promptInstall };
}
