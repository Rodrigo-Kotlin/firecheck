import { RefreshCw, WifiOff, Cloud } from 'lucide-react';

type SyncNowButtonProps = {
  isOnline: boolean;
  syncing: boolean;
  pending: number;
  onClick: () => void;
};

const variantClass = {
  syncing: 'sync-now--syncing',
  offline: 'sync-now--offline',
  pending: 'sync-now--pending',
  idle: '',
};

const SyncIcon = {
  syncing: RefreshCw,
  offline: WifiOff,
  pending: RefreshCw,
  idle: Cloud,
};

export function SyncNowButton({ isOnline, syncing, pending, onClick }: SyncNowButtonProps) {
  let label: string;
  let variant: keyof typeof variantClass;

  if (syncing) {
    label = 'Sincronizando...';
    variant = 'syncing';
  } else if (!isOnline) {
    label = 'Sem conexão';
    variant = 'offline';
  } else if (pending > 0) {
    label = 'Sincronizar agora';
    variant = 'pending';
  } else {
    label = 'Sincronizado';
    variant = 'idle';
  }

  const Icon = SyncIcon[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isOnline || syncing}
      className={`sync-now ${variantClass[variant]}`}
      title={!isOnline ? 'Aguardando conexão para sincronizar' : 'Enviar alterações para a nuvem'}
    >
      <Icon className={`sync-now__icon ${syncing ? 'animate-spin' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {pending > 0 && !syncing && (
        <span className="sync-now__count">{pending}</span>
      )}
    </button>
  );
}
