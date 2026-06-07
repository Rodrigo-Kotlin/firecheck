import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useToasts, dismissToast, type Toast, type ToastKind } from '../hooks/useToasts';

const kindConfig: Record<ToastKind, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: 'toast--info' },
  success: { icon: CheckCircle2, className: 'toast--success' },
  warning: { icon: XCircle, className: 'toast--warning' },
  error: { icon: XCircle, className: 'toast--error' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const cfg = kindConfig[toast.kind];
  const Icon = toast.icon ?? cfg.icon;

  const handleAction = () => {
    if (toast.action) {
      toast.action.onClick();
      dismissToast(toast.id);
    }
  };

  return (
    <div
      className={`toast ${cfg.className}`}
      role={toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
    >
      <Icon className="toast__icon" />
      <div className="toast__body">
        <div className="toast__title">{toast.title}</div>
        {toast.description && <div className="toast__description">{toast.description}</div>}
      </div>
      <div className="toast__actions">
        {toast.action && (
          <button
            type="button"
            onClick={handleAction}
            className="toast__action"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          className="toast__close"
          aria-label="Fechar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Toaster(): ReactNode {
  const toasts = useToasts();

  return (
    <div className="toaster no-print" aria-label="Notificações">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
