import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, ShieldCheck, Download } from 'lucide-react';
import type { Equipment } from '../types';

interface QrCodePrintCardProps {
  equipment: Equipment;
  onClose: () => void;
}

function formatDateBr(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function QrCodePrintCard({ equipment, onClose }: QrCodePrintCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(equipment.id, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: {
        dark: '#111111',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('[QrCodePrintCard] Falha ao gerar QR Code:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [equipment.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${equipment.id}.png`;
    a.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Confirmation banner — hidden on print */}
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

      {/* Action buttons — hidden on print */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          <Printer className="w-5 h-5" />
          Imprimir QR Code
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="btn-ghost btn-auto flex-1 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Baixar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost btn-auto flex-1"
        >
          <X className="w-4 h-4" />
          Concluir
        </button>
      </div>

      {/* Printable label */}
      <div className="print-area">
        <div className="qr-label">
          <div className="qr-label__header">
            <div className="qr-label__brand">FireCheck</div>
            <div className="qr-label__subtitle">Identificação de Equipamento</div>
          </div>

          <div className="qr-label__body">
            <div className="qr-label__qr">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code do equipamento ${equipment.id}`} />
              ) : (
                <div className="qr-label__qr-placeholder">Gerando QR...</div>
              )}
            </div>

            <div className="qr-label__info">
              <div className="qr-label__id">{equipment.id}</div>
              <div className="qr-label__type">
                {equipment.tipo}
                {equipment.subtipo ? ` · ${equipment.subtipo}` : ''}
              </div>
              <div className="qr-label__row">
                <span className="qr-label__row-label">Local</span>
                <span className="qr-label__row-value">{equipment.local}</span>
              </div>
              <div className="qr-label__row">
                <span className="qr-label__row-label">Setor</span>
                <span className="qr-label__row-value">{equipment.setor}</span>
              </div>
              {equipment.pavimento && (
                <div className="qr-label__row">
                  <span className="qr-label__row-label">Pavimento</span>
                  <span className="qr-label__row-value">{equipment.pavimento}</span>
                </div>
              )}
            </div>
          </div>

          <div className="qr-label__footer">
            <span>Emitido em {formatDateBr(new Date().toISOString())}</span>
            <span>Escaneie para inspeção</span>
          </div>
        </div>
      </div>
    </div>
  );
}
