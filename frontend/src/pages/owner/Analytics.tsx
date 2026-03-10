import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { useProperties } from '@/hooks/useProperties';
import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const SOURCE_COLORS: Record<string, string> = {
  airbnb: '#FF385C',
  booking: '#003580',
  smoobu: '#7C3AED',
  direct: '#10B981',
};

const SOURCE_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  smoobu: 'Smoobu',
  direct: 'Direct',
};

type Period = '30d' | '3m' | '6m' | '1y';

const PERIOD_DAYS: Record<Period, number> = { '30d': 30, '3m': 90, '6m': 180, '1y': 365 };

function nightsBetween(checkin: string, checkout: string) {
  return Math.max(0, (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000);
}

export default function Analytics() {
  const { lang } = useApp();
  const { properties, loading: propsLoading } = useProperties();
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('3m');
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

  const cutoffStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS[period]);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rateMap = useMemo(() => {
    const m: Record<number, number> = {};
    properties.forEach(p => { m[p.id] = p.rate || 0; });
    return m;
  }, [properties]);

  const enriched = useMemo(() => {
    const cutoffMs = new Date(cutoffStr).getTime();
    const todayMs = new Date(todayStr).getTime();
    return bookings
      // Include any booking whose stay overlaps the window
      .filter(b => b.checkout_date > cutoffStr && b.checkin_date <= todayStr)
      .filter(b => selectedPropertyId === null || b.property_id === selectedPropertyId)
      .map(b => {
        // Clip nights to the period window [cutoff, today]
        const checkinMs = Math.max(new Date(b.checkin_date).getTime(), cutoffMs);
        const checkoutMs = Math.min(new Date(b.checkout_date).getTime(), todayMs + 86400000);
        const nights = Math.max(0, (checkoutMs - checkinMs) / 86400000);
        return {
          ...b,
          nights,
          revenue: nights * (rateMap[b.property_id] || 0),
        };
      });
  }, [bookings, cutoffStr, todayStr, rateMap, selectedPropertyId]);

  const totalRevenue = useMemo(() => enriched.reduce((s, b) => s + b.revenue, 0), [enriched]);

  const actualPeriodDays = useMemo(() => {
    const cutoffMs = new Date(cutoffStr).getTime();
    const endMs = new Date(todayStr).getTime() + 86400000;
    return Math.round((endMs - cutoffMs) / 86400000);
  }, [cutoffStr, todayStr]);

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
      .filter(p => p.task_date >= cutoffStr)
      .filter(p => selectedPropertyId === null || p.property_id === selectedPropertyId)
      .reduce((s, p) => s + (p.amount || 0), 0),
    [payments, cutoffStr, selectedPropertyId]
  );

  const netCashflow = useMemo(() => {
    const months = actualPeriodDays / 30;
    const filteredProps = selectedPropertyId !== null
      ? properties.filter(p => p.id === selectedPropertyId)
      : properties;
    const charges = filteredProps.reduce((s, p) => s + (p.monthly_charges || 0) * months, 0);
    const credit = filteredProps.reduce((s, p) => s + (p.credit_mensuel || 0) * months, 0);
    return Math.round(totalRevenue - charges - credit - cleanerCost);
  }, [totalRevenue, properties, period, cleanerCost, selectedPropertyId]);

  const chartData = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    enriched.forEach(b => {
      const month = b.checkin_date.slice(0, 7);
      if (!months[month]) months[month] = {};
      const src = b.source || 'direct';
      months[month][src] = (months[month][src] || 0) + b.revenue;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, srcs]) => ({ month, ...srcs }));
  }, [enriched]);

  const sources = useMemo(() => Array.from(new Set(enriched.map(b => b.source || 'direct'))), [enriched]);

  const propertyStats = useMemo(() => {
    const cutoffMs = new Date(cutoffStr).getTime();
    const endMs = new Date(todayStr).getTime() + 86400000;
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
      // Clip range to period window
      map[b.property_id].ranges.push([
        Math.max(new Date(b.checkin_date).getTime(), cutoffMs),
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
  }, [enriched]);

  const cleanerCostByProp = useMemo(() => {
    const map: Record<string, number> = {};
    payments.filter(p => p.task_date >= cutoffStr).forEach(p => {
      map[p.property_name] = (map[p.property_name] || 0) + (p.amount || 0);
    });
    return map;
  }, [payments, cutoffStr]);

  const fmt = (n: number) =>
    n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 });

  const PERIODS: Period[] = ['30d', '3m', '6m', '1y'];

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
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Top row: chart + distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue area chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {lang === 'fr' ? 'Revenus totaux' : 'Total Revenue'}
          </p>
          <p className="text-3xl font-bold mb-4">€{fmt(totalRevenue)}</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v?: number) => [`€${fmt(v ?? 0)}`, '']} />
                {sources.map(src => (
                  <Area
                    key={src}
                    type="monotone"
                    dataKey={src}
                    stackId="1"
                    stroke={SOURCE_COLORS[src] || '#6B7280'}
                    fill={SOURCE_COLORS[src] || '#6B7280'}
                    fillOpacity={0.6}
                    name={SOURCE_LABELS[src] || src}
                  />
                ))}
              </AreaChart>
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
            {lang === 'fr' ? 'Distribution' : 'Distribution'}
          </p>
          {propertyStats.length > 0 ? (
            <div className="flex flex-col gap-2">
              {propertyStats.map(ps => {
                const pct = totalRevenue > 0 ? Math.round((ps.revenue / totalRevenue) * 100) : 0;
                return (
                  <div
                    key={ps.id}
                    className="rounded-lg p-3 flex items-center justify-between"
                    style={{ backgroundColor: ps.color + '22', borderLeft: `3px solid ${ps.color}` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{ps.name}</p>
                      <p className="text-xs text-gray-500">€{fmt(ps.revenue)}</p>
                    </div>
                    <span className="text-xl font-bold ml-2 flex-shrink-0" style={{ color: ps.color }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
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
