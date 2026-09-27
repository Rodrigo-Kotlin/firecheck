import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { InspectionsByPeriodChartData } from '../../utils/controlCenterCharts';

interface InspectionsByPeriodChartProps {
  data: InspectionsByPeriodChartData[];
  title: string;
  description: string;
  period: '30d' | '90d' | '6m' | '12m';
}

export default function InspectionsByPeriodChart({ data, title, description, period }: InspectionsByPeriodChartProps) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  if (total === 0) {
    return (
      <div className="card-subtle bg-white p-6 flex flex-col items-center justify-center min-h-[280px] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
        <p className="text-xs text-gray-500 mt-2">Nenhuma inspeção registrada no período.</p>
      </div>
    );
  }

  const isDaily = period === '30d' || period === '90d';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => value ?? 0;

  return (
    <div className="card-subtle bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="period"
              width={isDaily ? 60 : 50}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              labelFormatter={(label) => label}
            />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 8, paddingBottom: 4 }}
            />
            <Bar
              dataKey="regular"
              stackId="a"
              name="Regular"
              fill="#16a34a"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="observacao"
              stackId="a"
              name="Observação"
              fill="#ca8a04"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="pendente"
              stackId="a"
              name="Pendente"
              fill="#f59e0b"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="vencido"
              stackId="a"
              name="Vencido"
              fill="#dc2626"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} /> Regular</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ca8a04' }} /> Observação</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} /> Pendente</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#dc2626' }} /> Vencido</span>
      </div>
    </div>
  );
}