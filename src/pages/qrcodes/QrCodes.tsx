import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import {
  Search,
  Printer,
  Download,
  CheckSquare,
  Square,
  Eye,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import QRCode from 'qrcode';
import { EQUIP_TYPES, STATUS_LABEL } from '../../constants/equipmentFormConfig';
import QrCodePrintCard from '../../components/QrCodePrintCard';
import type { Equipment } from '../../types';

type SortKey = 'id' | 'tipo' | 'setor' | 'local';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'id', label: 'Código' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'setor', label: 'Setor' },
  { key: 'local', label: 'Local' },
];

function useQrCache(ids: string[]): Record<string, string> {
  const [cache, setCache] = useState<Record<string, string>>({});
  useEffect(() => {
    for (const id of ids) {
      if (cache[id]) continue;
      QRCode.toDataURL(id, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 160,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
        .then((url) => setCache((prev) => ({ ...prev, [id]: url })))
        .catch(() => {});
    }
  }, [ids, cache]);
  return cache;
}

export default function QrCodes() {
  const { equipments } = useAppStore();

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterLocal, setFilterLocal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewTarget, setViewTarget] = useState<Equipment | null>(null);
  const [printQueue, setPrintQueue] = useState<string[]>([]);

  const uniqueSetores = useMemo(
    () => [...new Set(equipments.map((e) => e.setor))].sort(),
    [equipments],
  );
  const uniqueLocais = useMemo(
    () => [...new Set(equipments.map((e) => e.local))].sort(),
    [equipments],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipments
      .filter((eq) => {
        if (search && !eq.id.toLowerCase().includes(q) && !eq.tipo.toLowerCase().includes(q) && !eq.local.toLowerCase().includes(q) && !eq.setor.toLowerCase().includes(q)) return false;
        if (filterTipo && eq.tipo !== filterTipo) return false;
        if (filterSetor && eq.setor !== filterSetor) return false;
        if (filterLocal && eq.local !== filterLocal) return false;
        if (filterStatus && eq.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const va = (a[sortKey] ?? '').toLowerCase();
        const vb = (b[sortKey] ?? '').toLowerCase();
        return va.localeCompare(vb);
      });
  }, [equipments, search, filterTipo, filterSetor, filterLocal, filterStatus, sortKey]);

  const qrCache = useQrCache(filtered.map((e) => e.id));

  const hasActiveFilters = search || filterTipo || filterSetor || filterLocal || filterStatus;
  const clearFilters = () => {
    setSearch('');
    setFilterTipo('');
    setFilterSetor('');
    setFilterLocal('');
    setFilterStatus('');
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
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  };

  const handleDownloadSingle = async (id: string) => {
    try {
      const url = await QRCode.toDataURL(id, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 512,
        color: { dark: '#111111', light: '#FFFFFF' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${id}.png`;
      a.click();
      showToast({ kind: 'success', title: `QR ${id} baixado.` });
    } catch {
      showToast({ kind: 'error', title: 'Erro ao baixar QR.' });
    }
  };

  const handlePrintSelected = () => {
    if (selected.size === 0) return;
    setPrintQueue(Array.from(selected));
    setTimeout(() => window.print(), 600);
  };

  useEffect(() => {
    if (printQueue.length > 0) {
      const handler = () => setPrintQueue([]);
      window.addEventListener('afterprint', handler, { once: true });
      return () => window.removeEventListener('afterprint', handler);
    }
  }, [printQueue]);

  const printItems = printQueue.length > 0
    ? equipments.filter((e) => printQueue.includes(e.id))
    : [];

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">QR Codes</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Gerenciar Etiquetas
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
            {filtered.length} de {equipments.length} {equipments.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
      </header>

      {/* Search + Actions */}
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
              onClick={() => setSearch('')}
              className="w-10 h-10 -mr-1 flex items-center justify-center text-gray-400 hover:text-gray-700 active:scale-95 transition-all rounded-full shrink-0"
              aria-label="Limpar busca"
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-ghost btn-sm btn-auto ${showFilters ? 'ring-2 ring-primary/30' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
          <button
            type="button"
            onClick={handlePrintSelected}
            disabled={selected.size === 0}
            className="btn-primary sm:w-auto disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            {selected.size > 0
              ? `Imprimir (${selected.size})`
              : 'Imprimir'}
          </button>
        </div>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="card-subtle bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-uppercase">Filtros</span>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-[11px] font-bold uppercase tracking-wider text-critical hover:underline min-h-0">
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="field-label">Tipo</label>
              <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="field-input">
                <option value="">Todos</option>
                {EQUIP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Setor</label>
              <select value={filterSetor} onChange={(e) => setFilterSetor(e.target.value)} className="field-input">
                <option value="">Todos</option>
                {uniqueSetores.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Local</label>
              <select value={filterLocal} onChange={(e) => setFilterLocal(e.target.value)} className="field-input">
                <option value="">Todos</option>
                {uniqueLocais.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="field-input">
                <option value="">Todos</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ordenar por</span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortKey(opt.key)}
                  className={`h-8 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all ${
                    sortKey === opt.key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selection bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between">
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
          {selected.size > 0 && (
            <span className="text-xs font-bold text-primary">
              {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* QR List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((eq) => {
          const isSelected = selected.has(eq.id);
          return (
            <div
              key={eq.id}
              className={`card-subtle bg-white p-4 transition-all ${
                isSelected ? 'ring-2 ring-primary border-primary' : ''
              }`}
            >
              <div className="flex items-start gap-3">
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
                <div className="flex-shrink-0 w-20 h-20 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-1">
                  {qrCache[eq.id] ? (
                    <img src={qrCache[eq.id]} alt={`QR ${eq.id}`} className="w-full h-full" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-mono text-sm font-extrabold text-gray-900 truncate">
                    {eq.id}
                  </div>
                  <div className="text-xs font-bold text-gray-600 truncate">{eq.tipo}</div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <span className="truncate">{eq.local}</span>
                    <span className="text-gray-300">·</span>
                    <span className="truncate">{eq.setor}</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {STATUS_LABEL[eq.status] || eq.status}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setViewTarget(eq)}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-100 hover:bg-primary/5 hover:text-primary hover:border-primary/30 rounded-lg transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Visualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintQueue([eq.id]);
                    setTimeout(() => window.print(), 600);
                  }}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-100 hover:bg-primary/5 hover:text-primary hover:border-primary/30 rounded-lg transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(eq.id)}
                  className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                  title="Baixar PNG"
                  aria-label="Baixar QR"
                >
                  <Download className="w-4 h-4" />
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
                  ? 'Ajuste os filtros ou termos da busca.'
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

      {/* View modal */}
      {viewTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setViewTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Etiqueta</h3>
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <QrCodePrintCard equipment={viewTarget} onClose={() => setViewTarget(null)} />
          </div>
        </div>
      )}

      {/* Print area */}
      {printItems.length > 0 && (
        <div className="print-only">
          <QrCodePrintCard equipments={printItems} />
        </div>
      )}
    </div>
  );
}
