import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { useProperties } from '@/hooks/useProperties';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

function nightsBetween(checkin: string, checkout: string) {
  return Math.max(0, (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000);
}

type Period = 'currentMonth' | 'next3m' | 'next6m' | `year-${number}`;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function DistributionDonut({
  data,
  total,
  fmt,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  fmt: (n: number) => string;
}) {
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
              {positiveData.map((entry) => (
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

export default function Analytics() {
  const { lang } = useApp();
  const { properties, loading: propsLoading } = useProperties();
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<Period>('next3m');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/bookings').then(r => r.json()),
      apiFetch('/payments').then(r => r.json()),
    ])
      .then(([rawBookings, p]) => {
        // Deduplicate: same property + same dates = one booking
        const groups = new Map<string, any[]>();
        const arr = Array.isArray(rawBookings) ? rawBookings : [];
        for (const b of arr) {
          const key = `${b.property_id}|${b.checkin_date}|${b.checkout_date}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(b);
        }
        const deduped: any[] = [];
        for (const group of groups.values()) {
          const best = group.find((b: any) => b.guest_name && !/^(language:|message:|Check-(in|out)\s)/i.test(b.guest_name.trim())) || group[0];
          deduped.push(best);
        }
        setBookings(deduped);
        setPayments(Array.isArray(p) ? p : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    if (period === 'currentMonth') {
      return { start: monthStart, end: addMonths(monthStart, 1), chartYear: currentYear };
    }
    if (period === 'next3m') {
      return { start: monthStart, end: addMonths(monthStart, 3), chartYear: currentYear };
    }
    if (period === 'next6m') {
      return { start: monthStart, end: addMonths(monthStart, 6), chartYear: currentYear };
    }
    const year = Number(period.replace('year-', ''));
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), chartYear: year };
  }, [currentYear, period]);

  const rangeStartStr = useMemo(() => range.start.toISOString().slice(0, 10), [range]);
  const rangeEndStr = useMemo(() => range.end.toISOString().slice(0, 10), [range]);

  const rateMap = useMemo(() => {
    const m: Record<number, number> = {};
    properties.forEach(p => { m[p.id] = p.rate || 0; });
    return m;
  }, [properties]);

  const enriched = useMemo(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    return bookings
      .filter(b => b.checkout_date > rangeStartStr && b.checkin_date < rangeEndStr)
      .filter(b => selectedPropertyId === null || b.property_id === selectedPropertyId)
      .map(b => {
        const checkinMs = Math.max(new Date(b.checkin_date).getTime(), startMs);
        const checkoutMs = Math.min(new Date(b.checkout_date).getTime(), endMs);
        const nights = Math.max(0, (checkoutMs - checkinMs) / 86400000);
        return {
          ...b,
          visibleCheckinMs: checkinMs,
          visibleCheckoutMs: checkoutMs,
          nights,
          revenue: nights * (rateMap[b.property_id] || 0),
        };
      });
  }, [bookings, range, rangeEndStr, rangeStartStr, rateMap, selectedPropertyId]);

  const totalRevenue = useMemo(() => enriched.reduce((s, b) => s + b.revenue, 0), [enriched]);

  const actualPeriodDays = useMemo(() => {
    return Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
  }, [range]);

  const occupancyPct = useMemo(() => {
    const totalNights = enriched.reduce((s, b) => s + b.nights, 0);
    const numProps = selectedPropertyId !== null ? 1 : properties.length;
    const denom = numProps * actualPeriodDays;
    return denom > 0 ? Math.min(100, Math.round((totalNights / denom) * 100)) : 0;
  }, [enriched, properties, actualPeriodDays, selectedPropertyId]);

  const avgStay = useMemo(() => {
    if (!enriched.length) return 0;
    return +(enriched.reduce((s, b) => s + b.nights, 0) / enriched.length).toFixed(1);
  }, [enriched]);

  const avgRate = useMemo(() => {
    const nights = enriched.reduce((s, b) => s + b.nights, 0);
    return nights > 0 ? Math.round(totalRevenue / nights) : 0;
  }, [enriched, totalRevenue]);

  const cleanerCost = useMemo(() =>
    payments
      .filter(p => p.task_date >= rangeStartStr && p.task_date < rangeEndStr)
      .filter(p => selectedPropertyId === null || p.property_id === selectedPropertyId)
      .reduce((s, p) => s + (p.amount || 0), 0),
    [payments, rangeEndStr, rangeStartStr, selectedPropertyId]
  );

  const netCashflow = useMemo(() => {
    const months = actualPeriodDays / 30;
    const filteredProps = selectedPropertyId !== null
      ? properties.filter(p => p.id === selectedPropertyId)
      : properties;
    const charges = filteredProps.reduce((s, p) => s + (p.monthly_charges || 0) * months, 0);
    const credit = filteredProps.reduce((s, p) => s + (p.credit_mensuel || 0) * months, 0);
    return Math.round(totalRevenue - charges - credit - cleanerCost);
  }, [actualPeriodDays, cleanerCost, properties, selectedPropertyId, totalRevenue]);

  const propertyStats = useMemo(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    const map: Record<number, {
      name: string; color: string; bookings: number; revenue: number;
      ranges: Array<[number, number]>;
    }> = {};
    enriched.forEach(b => {
      if (!map[b.property_id]) {
        map[b.property_id] = {
          name: b.property_name || `Property ${b.property_id}`,
          color: b.property_color || '#6B7280',
          bookings: 0, revenue: 0, ranges: [],
        };
      }
      map[b.property_id].bookings++;
      map[b.property_id].revenue += b.revenue;
      map[b.property_id].ranges.push([
        Math.max(new Date(b.checkin_date).getTime(), startMs),
        Math.min(new Date(b.checkout_date).getTime(), endMs),
      ]);
    });
    return Object.entries(map)
      .map(([id, s]) => {
        // Merge overlapping ranges to get unique occupied nights
        const sorted = [...s.ranges].sort((a, b) => a[0] - b[0]);
        let uniqueMs = 0;
        let curStart = -1, curEnd = -1;
        for (const [start, end] of sorted) {
          if (start > curEnd) {
            if (curEnd > curStart) uniqueMs += curEnd - curStart;
            curStart = start; curEnd = end;
          } else {
            curEnd = Math.max(curEnd, end);
          }
        }
        if (curEnd > curStart) uniqueMs += curEnd - curStart;
        const uniqueNights = Math.round(uniqueMs / 86400000);
        return { id: Number(id), name: s.name, color: s.color, bookings: s.bookings, nights: uniqueNights, revenue: s.revenue };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [enriched, range]);

  const cleanerCostByProp = useMemo(() => {
    const map: Record<string, number> = {};
    payments.filter(p => p.task_date >= rangeStartStr && p.task_date < rangeEndStr).forEach(p => {
      map[p.property_name] = (map[p.property_name] || 0) + (p.amount || 0);
    });
    return map;
  }, [payments, rangeEndStr, rangeStartStr]);

  const distributionData = useMemo(() =>
    propertyStats.map(ps => ({ name: ps.name, value: Math.round(ps.revenue), color: ps.color })),
  [propertyStats]);

  const histogramTitle = useMemo(() => {
    if (period === 'currentMonth') return lang === 'fr' ? 'Revenus du mois en cours' : 'Current Month Revenue';
    if (period === 'next3m') return lang === 'fr' ? 'Revenus des 3 prochains mois' : 'Next 3 Months Revenue';
    if (period === 'next6m') return lang === 'fr' ? 'Revenus des 6 prochains mois' : 'Next 6 Months Revenue';
    return lang === 'fr' ? `Revenus ${range.chartYear}` : `${range.chartYear} Revenue`;
  }, [lang, period, range.chartYear]);

  const revenueHistogramData = useMemo(() => {
    const monthCount = Math.max(
      1,
      (range.end.getFullYear() - range.start.getFullYear()) * 12 + (range.end.getMonth() - range.start.getMonth())
    );
    const months = Array.from({ length: monthCount }, (_, idx) => {
      const date = addMonths(range.start, idx);
      return {
        key: date.toISOString().slice(0, 7),
        month: date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }),
      } as Record<string, string | number>;
    });

    const visibleProperties = selectedPropertyId !== null
      ? properties.filter(p => p.id === selectedPropertyId)
      : properties;

    months.forEach(entry => {
      visibleProperties.forEach((property: any) => {
        entry[`prop_${property.id}`] = 0;
      });
      entry.total = 0;
    });

    enriched.forEach((booking) => {
      months.forEach((monthEntry, idx) => {
        const monthStart = addMonths(range.start, idx);
        const monthEnd = addMonths(monthStart, 1);
        const overlapStart = Math.max(booking.visibleCheckinMs, monthStart.getTime());
        const overlapEnd = Math.min(booking.visibleCheckoutMs, monthEnd.getTime());
        const overlapNights = Math.max(0, (overlapEnd - overlapStart) / 86400000);
        if (overlapNights <= 0) return;
        const revenueShare = overlapNights * (rateMap[booking.property_id] || 0);
        const propKey = `prop_${booking.property_id}`;
        monthEntry[propKey] = Number(monthEntry[propKey] || 0) + revenueShare;
        monthEntry.total = Number(monthEntry.total || 0) + revenueShare;
      });
    });

    return months;
  }, [enriched, lang, properties, range.end, range.start, selectedPropertyId]);

  const fmt = (n: number) =>
    n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 });

  const PERIODS: Array<{ value: Period; label: string }> = [
    { value: 'currentMonth', label: lang === 'fr' ? 'Mois en cours' : 'Current Month' },
    { value: 'next3m', label: lang === 'fr' ? '3 prochains mois' : 'Next 3 Months' },
    { value: 'next6m', label: lang === 'fr' ? '6 prochains mois' : 'Next 6 Months' },
    { value: `year-${currentYear}`, label: String(currentYear) },
    { value: `year-${currentYear - 1}`, label: String(currentYear - 1) },
  ];

  if (loading || propsLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500" />
          {lang === 'fr' ? 'Analytique' : 'Analytics'}
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedPropertyId ?? ''}
            onChange={e => setSelectedPropertyId(e.target.value === '' ? null : Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{lang === 'fr' ? 'Toutes propriétés' : 'All Properties'}</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
            {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {p.label}
            </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top row: histogram + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue histogram */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {histogramTitle}
          </p>
          <p className="text-3xl font-bold mb-4">€{fmt(totalRevenue)}</p>
          {revenueHistogramData.some(row => Number(row.total) > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueHistogramData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v?: number) => [`€${fmt(v ?? 0)}`, '']} />
                <Legend />
                {(selectedPropertyId !== null ? properties.filter(p => p.id === selectedPropertyId) : properties).map((property: any) => (
                  <Bar
                    key={property.id}
                    dataKey={`prop_${property.id}`}
                    name={property.name}
                    fill={property.color || '#6B7280'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
                <Bar dataKey="total" name={lang === 'fr' ? 'Total' : 'Total'} fill="#111827" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
              {lang === 'fr' ? 'Aucune donnée pour cette période' : 'No data for this period'}
            </div>
          )}
        </div>

        {/* Property distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
            {lang === 'fr' ? 'Distribution des revenus' : 'Revenue Distribution'}
          </p>
          {distributionData.length > 0 ? (
            <DistributionDonut data={distributionData} total={totalRevenue} fmt={fmt} />
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              {lang === 'fr' ? 'Aucune donnée' : 'No data'}
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Occupation' : 'Occupancy'}
          </p>
          <p className={`text-2xl font-bold mt-1 ${occupancyPct < 60 ? 'text-red-500' : occupancyPct < 70 ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
            {occupancyPct}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Séjour moyen' : 'Avg Stay'}
          </p>
          <p className="text-2xl font-bold mt-1">
            {avgStay} <span className="text-sm font-normal text-gray-400">{lang === 'fr' ? 'nuits' : 'nights'}</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Tarif moyen' : 'Avg Rate'}
          </p>
          <p className="text-2xl font-bold mt-1">
            €{avgRate}<span className="text-sm font-normal text-gray-400">/n</span>
          </p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm ${netCashflow >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Cash-flow net' : 'Net Cashflow'}
          </p>
          <p className={`text-2xl font-bold mt-1 ${netCashflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {netCashflow >= 0 ? '+' : ''}€{fmt(netCashflow)}
          </p>
        </div>
      </div>

      {/* Per-property table */}
      {propertyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-700">
            <h2 className="text-sm font-semibold">{lang === 'fr' ? 'Par propriété' : 'By property'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b dark:border-gray-700">
                  <th className="text-left px-4 py-2">{lang === 'fr' ? 'Propriété' : 'Property'}</th>
                  <th className="text-right px-4 py-2">{lang === 'fr' ? 'Séjours' : 'Stays'}</th>
                  <th className="text-right px-4 py-2">{lang === 'fr' ? 'Nuits' : 'Nights'}</th>
                  <th className="text-right px-4 py-2">{lang === 'fr' ? 'Revenus' : 'Revenue'}</th>
                  <th className="text-right px-4 py-2">Occ%</th>
                  <th className="text-right px-4 py-2">{lang === 'fr' ? 'Ménage' : 'Cleaning'}</th>
                  <th className="text-right px-4 py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {propertyStats.map(ps => {
                  const occ = Math.min(100, Math.round((ps.nights / actualPeriodDays) * 100));
                  const cost = cleanerCostByProp[ps.name] || 0;
                  const net = ps.revenue - cost;
                  return (
                    <tr key={ps.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ps.color }} />
                          <span className="font-medium truncate max-w-[140px]">{ps.name}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 tabular-nums">{ps.bookings}</td>
                      <td className="text-right px-4 py-3 tabular-nums">{Math.round(ps.nights)}</td>
                      <td className="text-right px-4 py-3 tabular-nums font-medium">€{fmt(ps.revenue)}</td>
                      <td className="text-right px-4 py-3 tabular-nums">{occ}%</td>
                      <td className="text-right px-4 py-3 tabular-nums text-red-400">-€{fmt(cost)}</td>
                      <td className={`text-right px-4 py-3 tabular-nums font-semibold ${net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {net >= 0 ? '+' : ''}€{fmt(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
