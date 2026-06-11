import { WifiOff } from 'lucide-react';

type OfflineBannerProps = {
  pending: number;
  variant: 'mobile' | 'desktop';
};

const containerClass = {
  mobile: 'lg:hidden offline-banner',
  desktop: 'hidden lg:flex offline-banner',
};

export function OfflineBanner({ pending, variant }: OfflineBannerProps) {
  return (
    <div className={containerClass[variant]} role="status" aria-live="polite">
      <WifiOff className="offline-banner__icon" />
      <div className="offline-banner__body">
        <div className="offline-banner__title">Modo Offline</div>
        {variant === 'desktop' && (
          <div className="offline-banner__sub">
            Suas alterações estão sendo salvas localmente. Sincronizamos automaticamente ao reconectar.
          </div>
        )}
      </div>
      {pending > 0 && (
        <span className="offline-banner__pill" title="Alterações aguardando envio">
          {pending} pendente{pending === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
