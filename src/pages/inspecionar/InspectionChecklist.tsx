import { AlertTriangle, CheckCircle2, Minus, XCircle, type LucideIcon } from 'lucide-react';
import type { ChecklistValue } from './inspectionWorkflow';
import { CHECKLIST_VALUES } from './inspectionChecklistConfig';

const STATUS_CONFIGS: Record<
  ChecklistValue,
  { label: string; pillClass: string; selectedClass: string; icon: LucideIcon }
> = {
  OK: { label: 'OK', pillClass: 'bg-green-100 text-success', selectedClass: 'bg-green-100 text-success', icon: CheckCircle2 },
  ATENCAO: { label: 'Atenção', pillClass: 'bg-amber-100 text-pending', selectedClass: 'bg-amber-100 text-pending', icon: AlertTriangle },
  REPROVADO: { label: 'Falha', pillClass: 'bg-red-100 text-critical', selectedClass: 'bg-red-100 text-critical', icon: XCircle },
  'N.A.': { label: 'N.A.', pillClass: 'bg-gray-100 text-gray-500', selectedClass: 'bg-gray-200 text-gray-600', icon: Minus },
};

type InspectionChecklistProps = {
  items: string[];
  values: Record<string, ChecklistValue>;
  counts: Record<ChecklistValue, number>;
  onChange: (item: string, value: ChecklistValue) => void;
};

export function InspectionChecklist({ items, values, counts, onChange }: InspectionChecklistProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <span className="label-uppercase">Checklist Técnico</span>
          <p className="text-[10px] text-gray-500 mt-0.5">{items.length} itens · toque em cada ponto para classificar</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHECKLIST_VALUES.map((value) => {
            const count = counts[value];
            if (count === 0) return null;
            const config = STATUS_CONFIGS[value];
            const Icon = config.icon;
            return <span key={value} className={`pill ${config.pillClass}`}><Icon className="w-3 h-3" />{count} {config.label}</span>;
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, index) => {
          const selected = values[item];
          return (
            <div key={item} className="card-subtle bg-white space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-gray-800 leading-snug flex-1">{item}</span>
                <span className="text-[10px] font-bold text-gray-300 tabular-nums flex-shrink-0">{String(index + 1).padStart(2, '0')}/{String(items.length).padStart(2, '0')}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded-xl">
                {CHECKLIST_VALUES.map((value) => {
                  const config = STATUS_CONFIGS[value];
                  const Icon = config.icon;
                  const isSelected = selected === value;
                  return (
                    <button key={value} type="button" onClick={() => onChange(item, value)} className={`flex flex-col items-center justify-center gap-0.5 h-12 rounded-lg transition-all ${isSelected ? `${config.selectedClass} shadow-sm` : 'text-gray-400 hover:text-gray-600 active:scale-95'}`} aria-pressed={isSelected} aria-label={config.label}>
                      <Icon className="w-4 h-4" />
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
