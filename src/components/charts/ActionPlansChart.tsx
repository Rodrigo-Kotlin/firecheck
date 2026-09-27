import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import type { ActionPlanChartData, OverduePlansChartData } from '../../utils/controlCenterCharts';

interface ActionPlansChartProps {
  data: ActionPlanChartData[];
  overdueData: OverduePlansChartData[];
  title: string;
  description: string;
  onSelectStatus?: (status: string) => void;
  onSelectOverdue?: () => void;
}

export default function ActionPlansChart({ data, overdueData, title, description, onSelectStatus, onSelectOverdue }: ActionPlansChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const overdueTotal = overdueData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="card-subtle bg-white p-6 flex flex-col items-center justify-center min-h-[280px] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
        <p className="text-xs text-gray-500 mt-2">Nenhum plano de ação cadastrado.</p>
      </div>
    );
  }

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
              dataKey="label"
              width={100}
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
              dataKey="value"
              name="Planos"
              fill="#6b7280"
              radius={[0, 4, 4, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            >
              {data.map((item, index) => (
                <Cell key={`cell-${index}`} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2 text-[10px] font-medium">
            {data.map((item) => (
            <button key={item.label} type="button" onClick={() => onSelectStatus?.(item.status ?? item.label)} disabled={!onSelectStatus} className="flex items-center gap-1 enabled:hover:underline disabled:cursor-default">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label} ({item.value})
            </button>
          ))}
        </div>
        {overdueTotal > 0 && (
           <button type="button" onClick={onSelectOverdue} disabled={!onSelectOverdue} className="w-full text-left p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 enabled:hover:bg-red-100 disabled:cursor-default">
            <svg className="w-4 h-4 text-critical flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-medium text-red-800">
              <span className="font-bold">{overdueTotal}</span> plano{overdueTotal > 1 ? 's' : ''} atrasado{overdueTotal > 1 ? 's' : ''}
            </span>
           </button>
        )}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-xs font-medium">
          <span className="text-gray-500 flex-1">Total</span>
          <span className="font-bold text-gray-900 tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}
