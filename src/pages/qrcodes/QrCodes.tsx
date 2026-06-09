import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import {
  Search,
  Printer,
  Download,
  CheckSquare,
  Square,
  Shield,
  MapPin,
} from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import QRCode from 'qrcode';

function formatDateBr(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function QrCodes() {
  const { equipments } = useAppStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [printQueue, setPrintQueue] = useState<string[]>([]);
  const printFrameRef = useRef<HTMLDivElement>(null);

  const filtered = equipments.filter((eq) => {
    const q = search.toLowerCase();
    return (
      eq.id.toLowerCase().includes(q) ||
      eq.tipo.toLowerCase().includes(q) ||
      eq.local.toLowerCase().includes(q) ||
      eq.setor.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    filtered.forEach((eq) => {
      if (qrCache[eq.id]) return;
      QRCode.toDataURL(eq.id, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 160,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
        .then((url) => {
          setQrCache((prev) => ({ ...prev, [eq.id]: url }));
        })
        .catch(() => {});
    });
  }, [filtered, qrCache]);

  const generateFullSize = async (id: string): Promise<string> => {
    return QRCode.toDataURL(id, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: { dark: '#111111', light: '#FFFFFF' },
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  const handleDownloadSingle = async (eqId: string) => {
    try {
      const url = await generateFullSize(eqId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${eqId}.png`;
      a.click();
      showToast({ kind: 'success', title: `QR ${eqId} baixado.` });
    } catch {
      showToast({ kind: 'error', title: 'Erro ao baixar QR.' });
    }
  };

  const handlePrintSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPrintQueue(ids);
    // Generate full-size QR for all selected
    await Promise.all(
      ids.map(async (id) => {
        if (!qrCache[id] || qrCache[id].includes('width=160')) {
          const url = await generateFullSize(id);
          setQrCache((prev) => ({ ...prev, [id]: url }));
        }
      }),
    );
    setTimeout(() => {
      window.print();
    }, 600);
  };

  useEffect(() => {
    if (printQueue.length > 0) {
      const afterPrint = () => {
        setPrintQueue([]);
      };
      window.addEventListener('afterprint', afterPrint, { once: true });
      return () => window.removeEventListener('afterprint', afterPrint);
    }
  }, [printQueue]);

  const hasActiveFilters = search.length > 0;
  const clearFilters = () => setSearch('');

  const printItems = printQueue.length > 0
    ? equipments.filter((e) => printQueue.includes(e.id))
    : [];

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      {/* Header */}
      <header className="page-header">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">
            QR Codes
          </div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Gerenciar Etiquetas
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
            {filtered.length} de {equipments.length} {equipments.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
      </header>

      {/* Search + Batch Print */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex-1 flex items-center gap-3 h-14 px-4 bg-white border border-gray-200 rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-sm"
          role="search"
        >
          <label htmlFor="qr-search" className="sr-only">Buscar equipamentos</label>
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            id="qr-search"
            type="text"
            placeholder="Buscar por código, tipo, setor ou local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 h-full bg-transparent outline-none border-0 text-base font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={clearFilters}
              className="w-10 h-10 -mr-1 flex items-center justify-center text-gray-400 hover:text-gray-700 active:scale-95 transition-all rounded-full shrink-0"
              aria-label="Limpar busca"
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handlePrintSelected}
          disabled={selected.size === 0}
          className="btn-primary sm:w-auto disabled:opacity-50"
        >
          <Printer className="w-5 h-5" />
          {selected.size > 0
            ? `Imprimir (${selected.size})`
            : 'Imprimir Selecionados'}
        </button>
      </div>

      {/* Select all toggle */}
      {filtered.length > 0 && (
        <button
          type="button"
          onClick={selectAll}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-primary transition-colors"
        >
          {selected.size === filtered.length ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {selected.size === filtered.length
            ? 'Desmarcar todos'
            : `Selecionar todos (${filtered.length})`}
        </button>
      )}

      {/* QR List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((eq) => {
          const isSelected = selected.has(eq.id);
          return (
            <div
              key={eq.id}
              className={`card-subtle bg-white p-4 sm:p-5 flex gap-4 transition-all ${
                isSelected
                  ? 'ring-2 ring-primary border-primary'
                  : ''
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleSelect(eq.id)}
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                  isSelected
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
                }`}
                aria-label={isSelected ? `Desmarcar ${eq.id}` : `Selecionar ${eq.id}`}
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>

              {/* QR preview */}
              <div className="flex-shrink-0 w-20 h-20 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
                {qrCache[eq.id] ? (
                  <img
                    src={qrCache[eq.id]}
                    alt={`QR ${eq.id}`}
                    className="w-16 h-16"
                  />
                ) : (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-gray-900 bg-gray-50 px-1 py-0.5 rounded tracking-tight">
                    {eq.id}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{eq.tipo}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                  <span className="truncate">
                    {eq.local}
                    <span className="text-gray-300 mx-1">·</span>
                    {eq.setor}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(eq.id)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-primary transition-colors mt-1"
                >
                  <Download className="w-3 h-3" />
                  Baixar QR
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full card-subtle bg-white text-center py-14 px-6 space-y-3">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">Nenhum equipamento encontrado</p>
              <p className="text-xs text-gray-400 mt-1">
                {hasActiveFilters
                  ? 'Ajuste o termo da busca.'
                  : 'Cadastre equipamentos para gerar QR Codes.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-ghost btn-sm btn-auto mt-1">
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Print area — hidden on screen, visible during print */}
      {printItems.length > 0 && (
        <div ref={printFrameRef} className="print-only-print-area">
          <style>{`
            @media print {
              body { margin: 0; padding: 10mm; }
              .print-only-print-area { display: block !important; }
            }
            .print-only-print-area { display: none; }
            .print-only-print-area .qr-label-page {
              display: flex; flex-wrap: wrap; gap: 8mm;
            }
            .print-only-print-area .qr-label-item {
              width: 80mm; height: 50mm;
              border: 1px solid #ccc;
              border-radius: 3mm;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 2mm;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .print-only-print-area .qr-label-item img {
              width: 32mm; height: 32mm;
            }
            .print-only-print-area .qr-label-item .ql-code {
              font-family: monospace;
              font-size: 8pt;
              font-weight: 700;
              color: #111;
            }
            .print-only-print-area .qr-label-item .ql-info {
              font-size: 6pt;
              color: #666;
              text-align: center;
              line-height: 1.3;
            }
          `}</style>
          <div className="qr-label-page">
            {printItems.map((item) => (
              <div key={item.id} className="qr-label-item">
                {qrCache[item.id] && (
                  <img src={qrCache[item.id]} alt={`QR ${item.id}`} />
                )}
                <div className="ql-code">{item.id}</div>
                <div className="ql-info">
                  {item.tipo}
                  {item.subtipo ? ` · ${item.subtipo}` : ''}
                  <br />
                  {item.local} · {item.setor}
                  <br />
                  Emitido em {formatDateBr(new Date().toISOString())}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
