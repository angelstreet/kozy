import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DistributionDonut from './DistributionDonut';
import { DistributionDatum, RevenueHistogramRow } from './types';

type PropertyOption = {
  id: number;
  name: string;
  color: string;
};

type Props = {
  lang: string;
  histogramTitle: string;
  totalRevenue: number;
  totalBookedNights: number;
  upcomingRevenue: number;
  cleanerCost: number;
  netCashflow: number;
  revenueHistogramData: RevenueHistogramRow[];
  visibleProperties: PropertyOption[];
  distributionData: DistributionDatum[];
  fmt: (n: number) => string;
};

export default function EarningsTab({
  lang,
  histogramTitle,
  totalRevenue,
  totalBookedNights,
  upcomingRevenue,
  cleanerCost,
  netCashflow,
  revenueHistogramData,
  visibleProperties,
  distributionData,
  fmt,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] gap-4">
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em] mb-2">
            {histogramTitle}
          </p>
          <div className="flex flex-col gap-1 mb-4">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">€{fmt(totalRevenue)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalBookedNights} {lang === 'fr' ? 'nuits reservees dans la periode' : 'booked nights in range'}
            </p>
          </div>
          {revenueHistogramData.some(row => Number(row.total) > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueHistogramData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value?: number, name?: string) => [`€${fmt(value ?? 0)}`, name ?? '']} />
                <Legend />
                {visibleProperties.map(property => (
                  <Bar
                    key={property.id}
                    dataKey={`prop_${property.id}`}
                    name={property.name}
                    fill={property.color || '#6B7280'}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
                <Bar
                  dataKey="total"
                  name={lang === 'fr' ? 'Total' : 'Total'}
                  fill="#111827"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              {lang === 'fr' ? 'Aucune donnee pour cette periode' : 'No data for this period'}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em] mb-3">
            {lang === 'fr' ? 'Distribution des revenus' : 'Revenue distribution'}
          </p>
          {distributionData.length > 0 ? (
            <DistributionDonut data={distributionData} total={totalRevenue} fmt={fmt} />
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              {lang === 'fr' ? 'Aucune donnee' : 'No data'}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Revenu reserve' : 'Booked revenue'}
          </p>
          <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">€{fmt(upcomingRevenue)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Nuits vendues' : 'Sold nights'}
          </p>
          <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{totalBookedNights}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Menage' : 'Cleaning'}
          </p>
          <p className="text-2xl font-bold mt-2 text-red-500">-€{fmt(cleanerCost)}</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm ${netCashflow >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Cash-flow net' : 'Net cashflow'}
          </p>
          <p className={`text-2xl font-bold mt-2 ${netCashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {netCashflow >= 0 ? '+' : ''}€{fmt(netCashflow)}
          </p>
        </div>
      </div>
    </div>
  );
}
