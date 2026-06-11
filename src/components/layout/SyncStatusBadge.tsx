import { RefreshCw, type LucideIcon } from 'lucide-react';

type SyncStatusBadgeProps = {
  isOnline: boolean;
  syncing: boolean;
  pending: number;
  onClick: () => void;
};

const variantClass = {
  syncing: 'status-pill--syncing',
  offline: 'status-pill--offline',
  pending: 'status-pill--pending',
  online: 'status-pill--online',
};

const dotClass = {
  syncing: 'status-dot--spin',
  offline: 'status-dot--pulse',
  pending: 'status-dot--pulse',
  online: '',
};

export function SyncStatusBadge({ isOnline, syncing, pending, onClick }: SyncStatusBadgeProps) {
  let label: string;
  let variant: keyof typeof variantClass;
  let Icon: LucideIcon | null = null;

  if (syncing) {
    label = 'Sincronizando...';
    variant = 'syncing';
    Icon = RefreshCw;
  } else if (!isOnline) {
    label = 'Offline';
    variant = 'offline';
  } else if (pending > 0) {
    label = `${pending} pendente${pending === 1 ? '' : 's'}`;
    variant = 'pending';
  } else {
    label = 'Sincronizado';
    variant = 'online';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      className={`status-pill status-pill--clickable ${variantClass[variant]}`}
      title={isOnline ? 'Sincronizar com a nuvem' : 'Aguardando conexão'}
      aria-label={label}
    >
      {Icon ? (
        <Icon className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <span className={`status-dot ${dotClass[variant]}`} />
      )}
      <span>{label}</span>
    </button>
  );
}
