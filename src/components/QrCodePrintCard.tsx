import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, ShieldCheck, Download, Eye } from 'lucide-react';
import type { Equipment } from '../types';

interface SingleProps {
  equipment: Equipment;
  equipments?: never;
  onClose: () => void;
}

interface BatchProps {
  equipment?: never;
  equipments: Equipment[];
  onClose?: () => void;
}

type QrCodePrintCardProps = SingleProps | BatchProps;

function formatDateBr(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function useQrDataUrl(value: string, width: number = 512): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width,
      color: { dark: '#111111', light: '#FFFFFF' },
    })
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, width]);
  return url;
}

function QrCodeLabel({ equipment, qrSize = 180 }: { equipment: Equipment; qrSize?: number }) {
  // A identidade oficial é o campo id (TAG normalizada). qrCode/qrcode são mantidos
  // apenas para compatibilidade — sempre idênticos ao id.
  const value = equipment.id;
  const qrUrl = useQrDataUrl(value, qrSize);

  return (
    <div className="qr-label-print">
      <div className="ql-top-bar" />
      <div className="ql-brand">
        <span className="ql-brand-name">FireCheck</span>
        <span className="ql-brand-sub">Identificação de Equipamento</span>
      </div>
      <div className="ql-body">
        <div className="ql-qr">
          {qrUrl ? (
            <img src={qrUrl} alt={`QR ${equipment.id}`} />
          ) : (
            <div className="ql-qr-placeholder" />
          )}
        </div>
        <div className="ql-code">{equipment.id}</div>
        <div className="ql-type">{equipment.tipo}{equipment.subtipo ? ` · ${equipment.subtipo}` : ''}</div>
        <div className="ql-details">
          <div className="ql-detail">
            <span className="ql-detail-label">Local</span>
            <span className="ql-detail-value">{equipment.local}</span>
          </div>
          <div className="ql-detail">
            <span className="ql-detail-label">Setor</span>
            <span className="ql-detail-value">{equipment.setor}</span>
          </div>
          {equipment.pavimento && (
            <div className="ql-detail">
              <span className="ql-detail-label">Pavimento</span>
              <span className="ql-detail-value">{equipment.pavimento}</span>
            </div>
          )}
        </div>
      </div>
      <div className="ql-footer">
        <span>Emitido em {formatDateBr(new Date().toISOString())}</span>
        <span>Escaneie para inspecionar</span>
      </div>
    </div>
  );
}

export function QrCodeLabelCard({ equipment, onView }: { equipment: Equipment; onView?: () => void }) {
  const value = equipment.id;
  const qrUrl = useQrDataUrl(value, 160);

  const handleDownload = async () => {
    try {
      const url = await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 512,
        color: { dark: '#111111', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${equipment.id}.png`;
      a.click();
    } catch { /* ignore */ }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-16 h-16 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-1">
        {qrUrl ? (
          <img src={qrUrl} alt={`QR ${equipment.id}`} className="w-full h-full" />
        ) : (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="font-mono text-sm font-extrabold text-gray-900">{equipment.id}</div>
        <div className="text-xs font-bold text-gray-600 truncate">{equipment.tipo}</div>
        <div className="text-[11px] text-gray-400 truncate">{equipment.local} · {equipment.setor}</div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {onView && (
          <button
            type="button"
            onClick={onView}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            title="Visualizar etiqueta"
            aria-label="Visualizar etiqueta"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
          title="Baixar QR"
          aria-label="Baixar QR"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function QrCodePrintCard(props: QrCodePrintCardProps) {
  const isBatch = 'equipments' in props;
  const equipmentsList = isBatch ? props.equipments : (props.equipment ? [props.equipment] : []);
  const onClose = 'onClose' in props ? props.onClose : undefined;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {!isBatch && props.equipment && (
        <>
          <div className="card-subtle bg-white py-8 flex flex-col items-center justify-center text-center gap-3 border-l-4 border-l-success no-print">
            <div className="w-14 h-14 bg-green-50 text-success rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Equipamento cadastrado!</h3>
              <p className="text-sm text-gray-500 mt-1">
                Imprima o QR Code abaixo e cole-o próximo ao equipamento.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 no-print">
            <button type="button" onClick={handlePrint} className="btn-primary flex-1">
              <Printer className="w-5 h-5" />
              Imprimir QR Code
            </button>
            <button type="button" onClick={onClose} className="btn-ghost btn-auto flex-1">
              <X className="w-4 h-4" />
              Concluir
            </button>
          </div>
        </>
      )}

      {isBatch && equipmentsList && (
        <div className="no-print">
          <p className="text-sm text-gray-500 mb-3">
            {equipmentsList.length} etiqueta{equipmentsList.length !== 1 ? 's' : ''} para impressão
          </p>
        </div>
      )}

      <div className="print-area">
        <div className="qr-label-grid">
          {equipmentsList?.map((eq) => (
            <QrCodeLabel key={eq.id} equipment={eq} />
          ))}
        </div>
      </div>
    </div>
  );
}
