import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { InspectionsByPeriodChartData } from '../../utils/controlCenterCharts';

interface InspectionsByPeriodChartProps {
  data: InspectionsByPeriodChartData[];
  title: string;
  description: string;
  period: '30d' | '90d' | '6m' | '12m';
  onSelectPeriod?: (periodKey: string) => void;
  onSelectStatus?: (status: 'regular' | 'observacao' | 'pendente' | 'vencido') => void;
}

export default function InspectionsByPeriodChart({ data, title, description, period, onSelectPeriod, onSelectStatus }: InspectionsByPeriodChartProps) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  if (total === 0) {
    return (
       <div className="card-subtle bg-white p-4 sm:p-5 flex flex-col items-center justify-center min-h-[190px] sm:min-h-[220px] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
        <p className="text-xs text-gray-500 mt-2">Nenhuma inspeção no período.</p>
      </div>
    );
  }

  const isDaily = period === '30d' || period === '90d';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => value ?? 0;

  return (
    <div className="card-subtle bg-white p-3 sm:p-4 lg:p-5">
      <div className="mb-2.5">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="h-[220px] sm:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              interval={isDaily ? 'preserveStartEnd' : 0}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              domain={[0, 'dataMax']}
              width={isDaily ? 34 : 30}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border-soft)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="regular"
              stackId="a"
              name="Regular"
              fill="var(--color-success)"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="observacao"
              stackId="a"
              name="Observação"
              fill="var(--color-pending)"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="pendente"
              stackId="a"
              name="Pendente"
              fill="var(--color-pending)"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="vencido"
              stackId="a"
              name="Vencido"
              fill="var(--color-critical)"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-medium">
        {([
          ['regular', 'Regular', 'var(--color-success)'],
          ['observacao', 'Observação', 'var(--color-pending)'],
          ['pendente', 'Pendente', 'var(--color-pending)'],
          ['vencido', 'Vencido', 'var(--color-critical)'],
        ] as const).map(([status, label, color]) => (
          <button key={status} type="button" onClick={() => onSelectStatus?.(status)} disabled={!onSelectStatus} className="flex items-center gap-1 enabled:hover:underline disabled:cursor-default">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} /> {label}
          </button>
        ))}
      </div>
      {onSelectPeriod && (
        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
          {data.filter(item => item.total > 0).map(item => (
            <button key={item.periodKey ?? item.period} type="button" onClick={() => item.periodKey && onSelectPeriod(item.periodKey)} className="text-gray-500 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded px-1">
              {item.period}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
