import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store';
import QRCodePrintLabel from '../../components/QRCodePrintLabel';

const QR_PER_PAGE = 6;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export default function QrCodesImprimir() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const equipments = useAppStore((s) => s.equipments);

  const ids = useMemo(() => searchParams.getAll('id'), [searchParams]);

  const equipmentsToPrint = useMemo(() => {
    const active = equipments.filter(
      (e) => !e.deletedAt && !e.pendingDelete,
    );
    if (ids.length > 0) {
      return active
        .filter((e) => ids.includes(e.id))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    return active.sort((a, b) => a.id.localeCompare(b.id));
  }, [equipments, ids]);

  const pages = chunk(equipmentsToPrint, QR_PER_PAGE);

  const handlePrint = () => {
    window.print();
  };

  if (equipmentsToPrint.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-500 mb-4">
          Nenhum equipamento encontrado para impressão.
        </p>
        <button
          type="button"
          onClick={() => navigate('/qrcodes')}
          className="btn-ghost"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="qr-print-root">
      <header className="no-print" style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
        <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
          Impressão de QR Codes
          <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8, fontSize: 12 }}>
            ({equipmentsToPrint.length} etiqueta{equipmentsToPrint.length !== 1 ? 's' : ''})
          </span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary"
            style={{ width: 'auto', minHeight: 'auto', padding: '8px 16px', fontSize: 12 }}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => navigate('/qrcodes')}
            className="btn-ghost"
            style={{ width: 'auto', minHeight: 'auto', padding: '8px 16px', fontSize: 12 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </header>

      <main className="qr-print-content">
        {pages.map((page, pageIndex) => (
          <section key={pageIndex} className="qr-print-page">
            {page.map((equipment) => (
              <QRCodePrintLabel key={equipment.id} equipment={equipment} />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
