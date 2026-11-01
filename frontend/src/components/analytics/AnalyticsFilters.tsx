import { AnalyticsPeriod } from './types';

type PropertyOption = { id: number; name: string };

type Props = {
  lang: string;
  period: AnalyticsPeriod;
  setPeriod: (period: AnalyticsPeriod) => void;
  selectedPropertyId: number | null;
  setSelectedPropertyId: (id: number | null) => void;
  properties: PropertyOption[];
  currentYear: number;
};

export default function AnalyticsFilters({
  lang,
  period,
  setPeriod,
  selectedPropertyId,
  setSelectedPropertyId,
  properties,
  currentYear,
}: Props) {
  const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
    { value: 'currentMonth', label: lang === 'fr' ? 'Mois en cours' : 'Current Month' },
    { value: 'next3m', label: lang === 'fr' ? '3 prochains mois' : 'Next 3 Months' },
    { value: 'next6m', label: lang === 'fr' ? '6 prochains mois' : 'Next 6 Months' },
    { value: `year-${currentYear}`, label: String(currentYear) },
    { value: `year-${currentYear - 1}`, label: String(currentYear - 1) },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        value={selectedPropertyId ?? ''}
        onChange={e => setSelectedPropertyId(e.target.value === '' ? null : Number(e.target.value))}
        className="px-3 py-2 border border-line bg-surface text-sm font-medium rounded-xl focus:ring-2 focus:ring-accent"
      >
        <option value="">{lang === 'fr' ? 'Toutes proprietes' : 'All Properties'}</option>
        {properties.map(property => (
          <option key={property.id} value={property.id}>{property.name}</option>
        ))}
      </select>
      <div className="flex gap-1 bg-page rounded-xl p-1 flex-wrap">
        {periods.map(item => (
          <button
            key={item.value}
            onClick={() => setPeriod(item.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === item.value
                ? 'bg-surface text-accent'
                : 'text-muted hover:text-ink'
            } border border-line`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
