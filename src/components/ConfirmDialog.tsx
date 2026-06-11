import { AlertTriangle, X } from 'lucide-react';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-critical" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 h-10 px-4 bg-critical hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
