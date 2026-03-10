import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DistributionDatum } from './types';

type Props = {
  data: DistributionDatum[];
  total: number;
  fmt: (n: number) => string;
};

export default function DistributionDonut({ data, total, fmt }: Props) {
  const positiveData = data.filter(d => d.value > 0);
  if (positiveData.length === 0) return null;
  const totalPositive = positiveData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-40 h-40 relative flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={positiveData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {positiveData.map(entry => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value?: number, name?: string) => [`€${fmt(value ?? 0)}`, name ?? '']}
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-900 dark:text-white">€{fmt(total)}</span>
        </div>
      </div>
      <div className="space-y-1.5 w-full">
        {positiveData.map(item => {
          const pct = totalPositive > 0 ? (item.value / totalPositive) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-gray-500 dark:text-gray-400 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-gray-500 dark:text-gray-400">{pct.toFixed(1)}%</span>
                <span className="font-medium text-gray-900 dark:text-white">€{fmt(item.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
