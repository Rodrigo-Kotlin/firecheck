type ReloadFn = () => void;
type UpdateHandler = (reload: ReloadFn) => void;

let registered = false;

/**
 * Registers the PWA service worker (production only) and invokes
 * `onUpdateAvailable` when a new worker has finished installing and is
 * waiting to take over. The handler receives a `reload` callback that
 * posts `SKIP_WAITING` to the waiting worker; the page will then reload
 * automatically once the new worker activates and claims clients.
 */
export function register(onUpdateAvailable?: UpdateHandler): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (registered) return;
  registered = true;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const fireUpdate = (worker: ServiceWorker | null) => {
    if (!worker || !onUpdateAvailable) return;
    onUpdateAvailable(() => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  };

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        if (reg.waiting) {
          fireUpdate(reg.waiting);
          return;
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              fireUpdate(newWorker);
            }
          });
        });
      })
      .catch((err) => {
        console.error('[sw] Falha ao registrar o Service Worker:', err);
      });
  });
}
