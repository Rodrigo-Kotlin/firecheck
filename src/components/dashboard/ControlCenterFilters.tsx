import { useEffect, useRef, useState } from 'react';
import type { ControlCenterFilterOptions, ControlCenterFilters as FilterState, ControlCenterFilterKey } from '../../utils/controlCenterFilters';
import { Check, SlidersHorizontal, X } from 'lucide-react';

interface ControlCenterFiltersProps {
  options: ControlCenterFilterOptions;
  value: FilterState;
  active: boolean;
  onChange: (key: ControlCenterFilterKey, value: string) => void;
  onClear: () => void;
}

export default function ControlCenterFilters({ options, value, active, onChange, onClear }: ControlCenterFiltersProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const activeCount = Object.values(value).filter(Boolean).length;

  const fields: Array<{ key: ControlCenterFilterKey; label: string; options: string[] }> = [
    { key: 'setor', label: 'Setor', options: options.setor },
    { key: 'local', label: 'Localização', options: options.local },
    { key: 'tipo', label: 'Tipo de equipamento', options: options.tipo },
  ];

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      return;
    }

    wasOpenRef.current = true;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, select, [href], input, textarea'))
          .filter(element => !element.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const fieldsContent = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-w-0">
      {fields.map(field => (
        <label key={field.key} className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {field.label}
          <select
            value={value[field.key]}
            onChange={event => onChange(field.key, event.target.value)}
            className="mt-1 block w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Todos</option>
            {field.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </div>
  );

  return (
    <section className="control-center-filters" aria-labelledby="control-center-filters-title">
      <div className="card-subtle bg-white p-2.5 sm:p-3 hidden md:block">
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-2 w-40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 id="control-center-filters-title" className="text-xs font-black uppercase tracking-wider text-gray-700">Filtros globais</h2>
            {active && <span className="pill bg-primary/10 text-primary"><span>Ativos</span><span className="ml-1">{activeCount}</span></span>}
          </div>
          </div>
          {fieldsContent}
          {active && <button type="button" onClick={onClear} aria-label="Limpar filtros" className="h-10 px-3 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap"><X className="inline-block w-3.5 h-3.5 mr-1" /> Limpar</button>}
        </div>
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden w-full card-subtle bg-white px-3 py-2.5 flex items-center justify-between text-left hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="Abrir filtros"
        aria-controls="control-center-filters-sheet"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-700">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
        </span>
        <span className="text-[10px] font-bold text-gray-400">Abrir</span>
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-[70]" role="presentation">
          <button type="button" className="absolute inset-0 bg-gray-950/35" aria-label="Fechar filtros" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            id="control-center-filters-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="control-center-filters-title-mobile"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="control-center-filters-title-mobile" className="text-sm font-black text-gray-900">Filtros</h2>
              <button type="button" onClick={() => setOpen(false)} className="w-10 h-10 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center" aria-label="Fechar filtros"><X className="w-5 h-5" /></button>
            </div>
            {fieldsContent}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" onClick={onClear} disabled={!active} className="btn-ghost btn-sm btn-auto w-full disabled:opacity-40">Limpar</button>
              <button type="button" onClick={() => setOpen(false)} className="btn-primary btn-sm btn-auto w-full"><Check className="w-4 h-4" /> Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
