import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { SectorOccurrencesChartData } from '../../utils/controlCenterCharts';

interface SectorOccurrencesChartProps {
  data: SectorOccurrencesChartData[];
  title: string;
  description: string;
  onSelectSector?: (sector: string) => void;
}

export default function SectorOccurrencesChart({ data, title, description, onSelectSector }: SectorOccurrencesChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className="card-subtle bg-white p-6 flex flex-col items-center justify-center min-h-[280px] text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
        <p className="text-xs text-gray-500 mt-2">Nenhuma não conformidade registrada nos setores.</p>
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
              dataKey="setor"
              width={140}
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
            <Bar
              dataKey="count"
              name="Não conformidades"
              fill="#dc2626"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
       <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs font-medium">
        <span className="text-gray-500 flex-1">Total de equipamentos com NC</span>
        <span className="font-bold text-gray-900 tabular-nums">{total}</span>
       </div>
       {onSelectSector && (
         <div className="mt-2 flex flex-wrap gap-1">
           {data.map(item => (
             <button key={item.setor} type="button" onClick={() => onSelectSector(item.setor)} className="text-[10px] text-gray-500 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded px-1">
               Ver {item.setor}
             </button>
           ))}
         </div>
       )}
    </div>
  );
}
