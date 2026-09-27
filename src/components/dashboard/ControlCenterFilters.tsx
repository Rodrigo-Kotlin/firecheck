import type { ControlCenterFilterOptions, ControlCenterFilters as FilterState, ControlCenterFilterKey } from '../../utils/controlCenterFilters';
import { X } from 'lucide-react';

interface ControlCenterFiltersProps {
  options: ControlCenterFilterOptions;
  value: FilterState;
  active: boolean;
  onChange: (key: ControlCenterFilterKey, value: string) => void;
  onClear: () => void;
}

export default function ControlCenterFilters({ options, value, active, onChange, onClear }: ControlCenterFiltersProps) {
  const fields: Array<{ key: ControlCenterFilterKey; label: string; options: string[] }> = [
    { key: 'setor', label: 'Setor', options: options.setor },
    { key: 'local', label: 'Localização', options: options.local },
    { key: 'tipo', label: 'Tipo de equipamento', options: options.tipo },
  ];

  return (
    <section className="card-subtle bg-white p-4" aria-labelledby="control-center-filters-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 id="control-center-filters-title" className="text-xs font-black uppercase tracking-wider text-gray-700">Filtros globais</h2>
            {active && <span className="pill bg-primary/10 text-primary">Visão filtrada</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {active ? `Exibindo ${value.setor || 'todos os setores'} · ${value.local || 'todos os locais'} · ${value.tipo || 'todos os tipos'}` : 'Selecione setor, localização e tipo para atualizar a central.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:w-3/4">
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
        {active && (
          <button type="button" onClick={onClear} className="h-10 px-3 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary whitespace-nowrap">
            <X className="inline-block w-3.5 h-3.5 mr-1" /> Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
