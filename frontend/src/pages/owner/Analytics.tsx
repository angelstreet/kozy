import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { normalizeSource, getSourceColor, getSourceLabel } from '@/components/owner/bookingActivityUtils';
import { useProperties } from '@/hooks/useProperties';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import EarningsTab from '@/components/analytics/EarningsTab';
import PerformanceTab from '@/components/analytics/PerformanceTab';
import QualityTab from '@/components/analytics/QualityTab';
import ReportsTab from '@/components/analytics/ReportsTab';
import {
  AnalyticsPeriod,
  AnalyticsTab,
  ChannelSummary,
  DistributionDatum,
  PropertySummaryRow,
  QualityMetric,
  RevenueHistogramRow,
} from '@/components/analytics/types';

type BookingRecord = {
  id?: number;
  property_id: number;
  property_name?: string;
  property_color?: string;
  checkin_date: string;
  checkout_date: string;
  guest_name?: string;
  source?: string;
  status?: string | null;
};

type EnrichedBooking = BookingRecord & {
  visibleCheckinMs: number;
  visibleCheckoutMs: number;
  nights: number;
  revenue: number;
};

type PaymentRecord = {
  property_id: number;
  property_name?: string;
  task_date: string;
  amount?: number;
};

const STORAGE_KEYS = {
  tab: 'kozy_analytics_tab',
  period: 'kozy_analytics_period',
  propertyId: 'kozy_analytics_property_id',
} as const;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isAnalyticsTab(value: string | null): value is AnalyticsTab {
  return value === 'earnings' || value === 'performance' || value === 'quality' || value === 'reports';
}

function isAnalyticsPeriod(value: string | null): value is AnalyticsPeriod {
  return value === 'currentMonth' || value === 'next3m' || value === 'next6m' || /^year-\d{4}$/.test(value || '');
}

function readStoredTab() {
  if (typeof window === 'undefined') return 'earnings' as AnalyticsTab;
  const value = window.localStorage.getItem(STORAGE_KEYS.tab);
  return isAnalyticsTab(value) ? value : 'earnings';
}

function readStoredPeriod() {
  if (typeof window === 'undefined') return 'next3m' as AnalyticsPeriod;
  const value = window.localStorage.getItem(STORAGE_KEYS.period);
  return isAnalyticsPeriod(value) ? value : 'next3m';
}

function readStoredPropertyId() {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(STORAGE_KEYS.propertyId);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeCsvValue(value: string | number) {
  const normalized = String(value ?? '');
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const content = [headers, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const { lang } = useApp();
  const { properties, loading: propsLoading } = useProperties();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(readStoredTab);
  const [period, setPeriod] = useState<AnalyticsPeriod>(readStoredPeriod);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(readStoredPropertyId);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    Promise.all([
      apiFetch('/bookings').then(r => r.json()),
      apiFetch('/payments').then(r => r.json()),
    ])
      .then(([rawBookings, rawPayments]) => {
        const groups = new Map<string, BookingRecord[]>();
        const bookingList = Array.isArray(rawBookings) ? rawBookings : [];
        for (const booking of bookingList) {
          const key = `${booking.property_id}|${booking.checkin_date}|${booking.checkout_date}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(booking);
        }

        const deduped: BookingRecord[] = [];
        for (const group of groups.values()) {
          const best =
            group.find(item => item.guest_name && !/^(language:|message:|Check-(in|out)\s)/i.test(item.guest_name.trim())) ||
            group[0];
          deduped.push(best);
        }

        setBookings(deduped);
        setPayments(Array.isArray(rawPayments) ? rawPayments : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.tab, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.period, period);
  }, [period]);

  useEffect(() => {
    if (selectedPropertyId === null) {
      window.localStorage.removeItem(STORAGE_KEYS.propertyId);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.propertyId, String(selectedPropertyId));
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedPropertyId !== null && !properties.some(property => property.id === selectedPropertyId)) {
      setSelectedPropertyId(null);
    }
  }, [properties, selectedPropertyId]);

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

  const rangeStartStr = useMemo(() => range.start.toISOString().slice(0, 10), [range.start]);
  const rangeEndStr = useMemo(() => range.end.toISOString().slice(0, 10), [range.end]);

  const rateMap = useMemo(() => {
    const map: Record<number, number> = {};
    properties.forEach(property => {
      map[property.id] = property.rate || 0;
    });
    return map;
  }, [properties]);

  const enriched = useMemo<EnrichedBooking[]>(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    return bookings
      .filter(booking => booking.checkout_date > rangeStartStr && booking.checkin_date < rangeEndStr)
      .filter(booking => selectedPropertyId === null || booking.property_id === selectedPropertyId)
      .map(booking => {
        const visibleCheckinMs = Math.max(new Date(booking.checkin_date).getTime(), startMs);
        const visibleCheckoutMs = Math.min(new Date(booking.checkout_date).getTime(), endMs);
        const nights = Math.max(0, (visibleCheckoutMs - visibleCheckinMs) / 86400000);
        return {
          ...booking,
          visibleCheckinMs,
          visibleCheckoutMs,
          nights,
          revenue: nights * (rateMap[booking.property_id] || 0),
        };
      })
      .filter(booking => booking.nights > 0);
  }, [bookings, range.end, range.start, rangeEndStr, rangeStartStr, rateMap, selectedPropertyId]);

  const visibleProperties = useMemo(() => {
    return (selectedPropertyId !== null
      ? properties.filter(property => property.id === selectedPropertyId)
      : properties
    ).map(property => ({
      id: property.id,
      name: property.name,
      color: property.color || '#6B7280',
    }));
  }, [properties, selectedPropertyId]);

  const totalRevenue = useMemo(() => enriched.reduce((sum, booking) => sum + booking.revenue, 0), [enriched]);
  const totalBookedNights = useMemo(() => Math.round(enriched.reduce((sum, booking) => sum + booking.nights, 0)), [enriched]);
  const actualPeriodDays = useMemo(() => Math.round((range.end.getTime() - range.start.getTime()) / 86400000), [range.end, range.start]);

  const occupancyPct = useMemo(() => {
    const numProps = selectedPropertyId !== null ? 1 : properties.length;
    const denominator = numProps * actualPeriodDays;
    return denominator > 0 ? Math.min(100, Math.round((totalBookedNights / denominator) * 100)) : 0;
  }, [actualPeriodDays, properties.length, selectedPropertyId, totalBookedNights]);

  const avgStay = useMemo(() => {
    if (enriched.length === 0) return 0;
    return +(totalBookedNights / enriched.length).toFixed(1);
  }, [enriched.length, totalBookedNights]);

  const avgRate = useMemo(() => {
    return totalBookedNights > 0 ? Math.round(totalRevenue / totalBookedNights) : 0;
  }, [totalBookedNights, totalRevenue]);

  const cleanerCost = useMemo(() => {
    return payments
      .filter(payment => payment.task_date >= rangeStartStr && payment.task_date < rangeEndStr)
      .filter(payment => selectedPropertyId === null || payment.property_id === selectedPropertyId)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }, [payments, rangeEndStr, rangeStartStr, selectedPropertyId]);

  const netCashflow = useMemo(() => {
    const months = actualPeriodDays / 30;
    const selectedProperties = selectedPropertyId !== null
      ? properties.filter(property => property.id === selectedPropertyId)
      : properties;
    const charges = selectedProperties.reduce((sum, property) => sum + (property.monthly_charges || 0) * months, 0);
    const credit = selectedProperties.reduce((sum, property) => sum + (property.credit_mensuel || 0) * months, 0);
    return Math.round(totalRevenue - charges - credit - cleanerCost);
  }, [actualPeriodDays, cleanerCost, properties, selectedPropertyId, totalRevenue]);

  const cleanerCostByProperty = useMemo(() => {
    const map: Record<number, number> = {};
    payments
      .filter(payment => payment.task_date >= rangeStartStr && payment.task_date < rangeEndStr)
      .filter(payment => selectedPropertyId === null || payment.property_id === selectedPropertyId)
      .forEach(payment => {
        map[payment.property_id] = (map[payment.property_id] || 0) + (payment.amount || 0);
      });
    return map;
  }, [payments, rangeEndStr, rangeStartStr, selectedPropertyId]);

  const propertyStats = useMemo<PropertySummaryRow[]>(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    const map: Record<number, {
      name: string;
      color: string;
      bookings: number;
      revenue: number;
      ranges: Array<[number, number]>;
    }> = {};

    enriched.forEach(booking => {
      if (!map[booking.property_id]) {
        map[booking.property_id] = {
          name: booking.property_name || `Property ${booking.property_id}`,
          color: booking.property_color || '#6B7280',
          bookings: 0,
          revenue: 0,
          ranges: [],
        };
      }
      map[booking.property_id].bookings += 1;
      map[booking.property_id].revenue += booking.revenue;
      map[booking.property_id].ranges.push([
        Math.max(new Date(booking.checkin_date).getTime(), startMs),
        Math.min(new Date(booking.checkout_date).getTime(), endMs),
      ]);
    });

    return Object.entries(map)
      .map(([id, summary]) => {
        const sorted = [...summary.ranges].sort((a, b) => a[0] - b[0]);
        let uniqueMs = 0;
        let currentStart = -1;
        let currentEnd = -1;

        for (const [start, end] of sorted) {
          if (start > currentEnd) {
            if (currentEnd > currentStart) uniqueMs += currentEnd - currentStart;
            currentStart = start;
            currentEnd = end;
          } else {
            currentEnd = Math.max(currentEnd, end);
          }
        }

        if (currentEnd > currentStart) uniqueMs += currentEnd - currentStart;

        const nights = Math.round(uniqueMs / 86400000);
        const propertyId = Number(id);
        const cleaningCostForProperty = cleanerCostByProperty[propertyId] || 0;
        const net = summary.revenue - cleaningCostForProperty;
        return {
          id: propertyId,
          name: summary.name,
          color: summary.color,
          bookings: summary.bookings,
          nights,
          revenue: summary.revenue,
          occupancy: actualPeriodDays > 0 ? Math.min(100, Math.round((nights / actualPeriodDays) * 100)) : 0,
          cleaningCost: cleaningCostForProperty,
          net,
          avgRate: nights > 0 ? Math.round(summary.revenue / nights) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [actualPeriodDays, cleanerCostByProperty, enriched, range.end, range.start]);

  const distributionData = useMemo<DistributionDatum[]>(
    () => propertyStats.map(property => ({ name: property.name, value: Math.round(property.revenue), color: property.color })),
    [propertyStats]
  );

  const channelSummaries = useMemo<ChannelSummary[]>(() => {
    const map = new Map<string, ChannelSummary>();
    enriched.forEach(booking => {
      const key = normalizeSource(booking.source || 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: getSourceLabel(booking.source || 'Unknown'),
          color: getSourceColor(booking.source || 'unknown'),
          bookings: 0,
          nights: 0,
          revenue: 0,
          cancellations: null,
          cancellationRate: null,
        });
      }
      const summary = map.get(key)!;
      summary.bookings += 1;
      summary.nights += Math.round(booking.nights);
      summary.revenue += booking.revenue;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [enriched]);

  const histogramTitle = useMemo(() => {
    if (period === 'currentMonth') return lang === 'fr' ? 'Revenus du mois en cours' : 'Current Month Revenue';
    if (period === 'next3m') return lang === 'fr' ? 'Revenus des 3 prochains mois' : 'Next 3 Months Revenue';
    if (period === 'next6m') return lang === 'fr' ? 'Revenus des 6 prochains mois' : 'Next 6 Months Revenue';
    return lang === 'fr' ? `Revenus ${range.chartYear}` : `${range.chartYear} Revenue`;
  }, [lang, period, range.chartYear]);

  const revenueHistogramData = useMemo<RevenueHistogramRow[]>(() => {
    const monthCount = Math.max(
      1,
      (range.end.getFullYear() - range.start.getFullYear()) * 12 + (range.end.getMonth() - range.start.getMonth())
    );

    const rows: RevenueHistogramRow[] = Array.from({ length: monthCount }, (_, idx) => {
      const date = addMonths(range.start, idx);
      return {
        key: date.toISOString().slice(0, 7),
        month: date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }),
        total: 0,
      };
    });

    rows.forEach(row => {
      visibleProperties.forEach(property => {
        row[`prop_${property.id}`] = 0;
      });
    });

    enriched.forEach(booking => {
      rows.forEach((row, idx) => {
        const monthStart = addMonths(range.start, idx);
        const monthEnd = addMonths(monthStart, 1);
        const overlapStart = Math.max(booking.visibleCheckinMs, monthStart.getTime());
        const overlapEnd = Math.min(booking.visibleCheckoutMs, monthEnd.getTime());
        const overlapNights = Math.max(0, (overlapEnd - overlapStart) / 86400000);
        if (overlapNights <= 0) return;
        const revenueShare = overlapNights * (rateMap[booking.property_id] || 0);
        const propKey = `prop_${booking.property_id}`;
        row[propKey] = Number(row[propKey] || 0) + revenueShare;
        row.total += revenueShare;
      });
    });

    return rows;
  }, [enriched, lang, range.end, range.start, rateMap, visibleProperties]);

  const fmt = (value: number) =>
    value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 });

  const selectedPropertyName = useMemo(() => {
    if (selectedPropertyId === null) return lang === 'fr' ? 'Toutes proprietes' : 'All properties';
    return properties.find(property => property.id === selectedPropertyId)?.name || (lang === 'fr' ? 'Propriete' : 'Property');
  }, [lang, properties, selectedPropertyId]);

  const periodLabel = useMemo(() => {
    if (period === 'currentMonth') return lang === 'fr' ? 'Mois en cours' : 'Current Month';
    if (period === 'next3m') return lang === 'fr' ? '3 prochains mois' : 'Next 3 Months';
    if (period === 'next6m') return lang === 'fr' ? '6 prochains mois' : 'Next 6 Months';
    return period.replace('year-', '');
  }, [lang, period]);

  const qualityMetrics = useMemo<QualityMetric[]>(() => {
    const knownGuestCount = enriched.filter(booking => Boolean(booking.guest_name?.trim())).length;
    const knownSourceCount = enriched.filter(booking => Boolean(normalizeSource(booking.source || ''))).length;
    const cleaningEntries = payments
      .filter(payment => payment.task_date >= rangeStartStr && payment.task_date < rangeEndStr)
      .filter(payment => selectedPropertyId === null || payment.property_id === selectedPropertyId).length;

    const bookingCount = enriched.length;
    const guestPct = bookingCount > 0 ? Math.round((knownGuestCount / bookingCount) * 100) : 0;
    const sourcePct = bookingCount > 0 ? Math.round((knownSourceCount / bookingCount) * 100) : 0;
    const cleaningPct = bookingCount > 0 ? Math.min(100, Math.round((cleaningEntries / bookingCount) * 100)) : 0;

    return [
      {
        label: lang === 'fr' ? 'Reservations nommees' : 'Named bookings',
        value: `${guestPct}%`,
        hint: lang === 'fr' ? 'Part des reservations avec un nom exploitable.' : 'Share of bookings with a usable guest name.',
      },
      {
        label: lang === 'fr' ? 'Canal identifie' : 'Channel tagged',
        value: `${sourcePct}%`,
        hint: lang === 'fr' ? 'Part des reservations avec une source exploitable.' : 'Share of bookings with a usable channel source.',
      },
      {
        label: lang === 'fr' ? 'Menage journalise' : 'Cleaning logged',
        value: `${cleaningPct}%`,
        hint: lang === 'fr' ? 'Paiements de menage saisis par rapport aux sejours visibles.' : 'Cleaning payments logged relative to visible stays.',
      },
    ];
  }, [enriched, lang, payments, rangeEndStr, rangeStartStr, selectedPropertyId]);

  const reportSummary = useMemo(() => {
    return [
      {
        label: lang === 'fr' ? 'Fenetre' : 'Window',
        value: periodLabel,
        hint: selectedPropertyName,
      },
      {
        label: lang === 'fr' ? 'Reservations' : 'Bookings',
        value: String(enriched.length),
        hint: lang === 'fr' ? 'Reservations visibles dans cette vue.' : 'Bookings visible in this view.',
      },
      {
        label: lang === 'fr' ? 'Revenus' : 'Revenue',
        value: `€${fmt(totalRevenue)}`,
        hint: lang === 'fr' ? 'Total exportable pour la selection courante.' : 'Exportable total for the current selection.',
      },
    ];
  }, [enriched.length, fmt, lang, periodLabel, selectedPropertyName, totalRevenue]);

  const exportPrefix = useMemo(() => {
    const propertySlug = selectedPropertyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `analytics-${period}-${propertySlug || 'all-properties'}`;
  }, [period, selectedPropertyName]);

  const handleExportBookings = () => {
    downloadCsv(
      `${exportPrefix}-bookings.csv`,
      ['Property', 'Guest', 'Source', 'Check-in', 'Check-out', 'Nights', 'Revenue'],
      enriched.map(booking => [
        booking.property_name || `Property ${booking.property_id}`,
        booking.guest_name || '',
        getSourceLabel(booking.source || ''),
        booking.checkin_date,
        booking.checkout_date,
        Math.round(booking.nights),
        Math.round(booking.revenue),
      ])
    );
  };

  const handleExportProperties = () => {
    downloadCsv(
      `${exportPrefix}-properties.csv`,
      ['Property', 'Stays', 'Nights', 'Occupancy %', 'Revenue', 'Avg Rate', 'Cleaning', 'Net'],
      propertyStats.map(property => [
        property.name,
        property.bookings,
        property.nights,
        property.occupancy,
        Math.round(property.revenue),
        property.avgRate,
        Math.round(property.cleaningCost),
        Math.round(property.net),
      ])
    );
  };

  const handleExportRevenue = () => {
    const headers = ['Month', ...visibleProperties.map(property => property.name), 'Total'];
    downloadCsv(
      `${exportPrefix}-monthly-revenue.csv`,
      headers,
      revenueHistogramData.map(row => [
        row.month,
        ...visibleProperties.map(property => Math.round(Number(row[`prop_${property.id}`] || 0))),
        Math.round(row.total),
      ])
    );
  };

  if (loading || propsLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
            {lang === 'fr' ? 'Analytique' : 'Analytics'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lang === 'fr'
              ? 'Structuree comme Airbnb: revenus, performance, qualite, rapports.'
              : 'Structured like Airbnb: earnings, performance, quality, reports.'}
          </p>
        </div>
        <AnalyticsFilters
          lang={lang}
          period={period}
          setPeriod={setPeriod}
          selectedPropertyId={selectedPropertyId}
          setSelectedPropertyId={setSelectedPropertyId}
          properties={properties}
          currentYear={currentYear}
        />
      </div>

      <AnalyticsTabs activeTab={activeTab} onChange={setActiveTab} lang={lang} />

      {activeTab === 'earnings' && (
        <EarningsTab
          lang={lang}
          histogramTitle={histogramTitle}
          totalRevenue={Math.round(totalRevenue)}
          totalBookedNights={totalBookedNights}
          upcomingRevenue={Math.round(totalRevenue)}
          cleanerCost={Math.round(cleanerCost)}
          netCashflow={netCashflow}
          revenueHistogramData={revenueHistogramData}
          visibleProperties={visibleProperties}
          distributionData={distributionData}
          fmt={fmt}
        />
      )}

      {activeTab === 'performance' && (
        <PerformanceTab
          lang={lang}
          occupancyPct={occupancyPct}
          avgStay={avgStay}
          avgRate={avgRate}
          totalBookedNights={totalBookedNights}
          propertyStats={propertyStats}
          channelSummaries={channelSummaries}
          actualPeriodDays={actualPeriodDays}
          fmt={fmt}
        />
      )}

      {activeTab === 'quality' && (
        <QualityTab lang={lang} qualityMetrics={qualityMetrics} />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          lang={lang}
          reportSummary={reportSummary}
          onExportBookings={handleExportBookings}
          onExportProperties={handleExportProperties}
          onExportRevenue={handleExportRevenue}
        />
      )}
    </div>
  );
}
