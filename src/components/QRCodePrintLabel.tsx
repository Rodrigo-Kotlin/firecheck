import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Equipment } from '../types';
import { formatDateBR, getLocalDateISO } from '../utils/date';

export default function QRCodePrintLabel({ equipment }: { equipment: Equipment }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(equipment.id, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: { dark: '#111111', light: '#FFFFFF' },
    })
      .then((u) => { if (!cancelled) setQrUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [equipment.id]);

  return (
    <div className="qr-print-card">
      <div className="qr-print-topbar" />
      <div className="qr-print-brand">
        <span className="qr-print-brand-name">EFETIVA SST</span>
        <span className="qr-print-brand-sub">Inspeção de Equipamentos</span>
      </div>
      <div className="qr-print-qr">
        {qrUrl ? (
          <img src={qrUrl} alt={`QR ${equipment.id}`} />
        ) : (
          <div className="qr-print-placeholder" />
        )}
      </div>
      <div className="qr-print-tag">{equipment.id}</div>
      <div className="qr-print-info">
        {equipment.tipo}{equipment.subtipo ? ` · ${equipment.subtipo}` : ''}
      </div>
      <div className="qr-print-details">
        <div className="qr-print-detail">
          <span className="qr-print-detail-label">Local</span>
          <span className="qr-print-detail-value">{equipment.local}</span>
        </div>
        <div className="qr-print-detail">
          <span className="qr-print-detail-label">Setor</span>
          <span className="qr-print-detail-value">{equipment.setor}</span>
        </div>
        {equipment.pavimento && (
          <div className="qr-print-detail">
            <span className="qr-print-detail-label">Pavimento</span>
            <span className="qr-print-detail-value">{equipment.pavimento}</span>
          </div>
        )}
      </div>
      <div className="qr-print-footer">
        Emitido em {formatDateBR(getLocalDateISO())}
      </div>
    </div>
  );
}
