import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { EquipmentSituationChartData } from '../../utils/controlCenterCharts';

interface EquipmentSituationChartProps {
  data: EquipmentSituationChartData[];
  title: string;
  description: string;
  onSelectCategory?: (category: NonNullable<EquipmentSituationChartData['category']>) => void;
}

export default function EquipmentSituationChart({ data, title, description, onSelectCategory }: EquipmentSituationChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="card-subtle bg-white p-6 flex flex-col items-center justify-center min-h-[280px] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
        <p className="text-xs text-gray-500 mt-2">Nenhum equipamento cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="card-subtle bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="w-full lg:w-1/2">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="label"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
                isAnimationActive={false}
              >
                {data.map((item, index) => (
                  <Cell key={`cell-${index}`} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => value}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
                labelFormatter={(label) => label}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:w-1/2 space-y-2">
           {data.map((item) => (
             <button
               key={item.label}
               type="button"
               disabled={!item.category || !onSelectCategory}
               onClick={() => item.category && onSelectCategory?.(item.category)}
               className="w-full flex items-center gap-3 text-left rounded px-1 py-0.5 enabled:hover:bg-gray-50 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-primary disabled:cursor-default"
             >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs font-medium text-gray-700 truncate flex-1">{item.label}</span>
              <span className="text-xs font-bold text-gray-900 tabular-nums">{item.value}</span>
              <span className="text-xs text-gray-400">({item.percentage}%)</span>
             </button>
          ))}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 flex-1">Total</span>
            <span className="text-xs font-bold text-gray-900 tabular-nums">{total}</span>
            <span className="text-xs text-gray-400">(100%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
