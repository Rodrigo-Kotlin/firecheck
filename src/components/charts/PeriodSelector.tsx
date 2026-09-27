type PeriodOption = '30d' | '90d' | '6m' | '12m';

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
];

interface PeriodSelectorProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="chart-period" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        Período
      </label>
      <select
        id="chart-period"
        value={value}
        onChange={(e) => onChange(e.target.value as PeriodOption)}
        className="field-input text-sm py-1.5 px-3 min-w-[140px]"
        aria-label="Selecionar período do gráfico"
      >
        {PERIOD_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}