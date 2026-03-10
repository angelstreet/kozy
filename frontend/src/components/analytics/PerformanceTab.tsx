import { ChannelSummary, PropertySummaryRow } from './types';

type Props = {
  lang: string;
  occupancyPct: number;
  avgStay: number;
  avgRate: number;
  totalBookedNights: number;
  propertyStats: PropertySummaryRow[];
  channelSummaries: ChannelSummary[];
  actualPeriodDays: number;
  fmt: (n: number) => string;
};

function getOccupancyTone(occupancyPct: number) {
  if (occupancyPct < 60) return 'text-red-500';
  if (occupancyPct < 70) return 'text-orange-500';
  return 'text-green-600 dark:text-green-400';
}

export default function PerformanceTab({
  lang,
  occupancyPct,
  avgStay,
  avgRate,
  totalBookedNights,
  propertyStats,
  channelSummaries,
  actualPeriodDays,
  fmt,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Occupation' : 'Occupancy'}
          </p>
          <p className={`text-3xl font-bold mt-2 ${getOccupancyTone(occupancyPct)}`}>{occupancyPct}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Sejour moyen' : 'Avg stay'}
          </p>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{avgStay}</p>
          <p className="text-sm text-gray-400">{lang === 'fr' ? 'nuits' : 'nights'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Tarif moyen' : 'Avg rate'}
          </p>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">€{fmt(avgRate)}</p>
          <p className="text-sm text-gray-400">/ {lang === 'fr' ? 'nuit' : 'night'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {lang === 'fr' ? 'Nuits reservees' : 'Booked nights'}
          </p>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{totalBookedNights}</p>
          <p className="text-sm text-gray-400">{actualPeriodDays} {lang === 'fr' ? 'jours dans la fenetre' : 'days in range'}</p>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
              {lang === 'fr' ? 'Canaux' : 'Channels'}
            </p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {lang === 'fr' ? 'Performance par source' : 'Performance by source'}
            </h2>
          </div>
          <p className="text-xs text-gray-400">
            {lang === 'fr' ? 'Annulations non disponibles dans le flux actuel' : 'Cancellations unavailable in current feed'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {channelSummaries.map(channel => (
            <div
              key={channel.key}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              style={{ borderLeftWidth: 4, borderLeftColor: channel.color }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: channel.color }} />
                  <p className="font-semibold truncate text-gray-900 dark:text-white">{channel.label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">€{fmt(channel.revenue)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div>
                  <p className="text-gray-400">{lang === 'fr' ? 'Sejours' : 'Stays'}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{channel.bookings}</p>
                </div>
                <div>
                  <p className="text-gray-400">{lang === 'fr' ? 'Nuits' : 'Nights'}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{channel.nights}</p>
                </div>
                <div>
                  <p className="text-gray-400">{lang === 'fr' ? 'ADR' : 'ADR'}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    €{fmt(channel.nights > 0 ? Math.round(channel.revenue / channel.nights) : 0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
            {lang === 'fr' ? 'Portefeuille' : 'Portfolio'}
          </p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Performance par propriete' : 'Performance by property'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b dark:border-gray-700">
                <th className="text-left px-4 py-3">{lang === 'fr' ? 'Propriete' : 'Property'}</th>
                <th className="text-right px-4 py-3">{lang === 'fr' ? 'Sejours' : 'Stays'}</th>
                <th className="text-right px-4 py-3">{lang === 'fr' ? 'Nuits' : 'Nights'}</th>
                <th className="text-right px-4 py-3">Occ%</th>
                <th className="text-right px-4 py-3">{lang === 'fr' ? 'ADR' : 'ADR'}</th>
                <th className="text-right px-4 py-3">{lang === 'fr' ? 'Menage' : 'Cleaning'}</th>
                <th className="text-right px-4 py-3">{lang === 'fr' ? 'Net' : 'Net'}</th>
              </tr>
            </thead>
            <tbody>
              {propertyStats.map(property => (
                <tr
                  key={property.id}
                  className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{ borderLeft: `3px solid ${property.color}` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: property.color }} />
                      <span className="font-medium truncate max-w-[180px]" style={{ color: property.color }}>
                        {property.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums">{property.bookings}</td>
                  <td className="text-right px-4 py-3 tabular-nums">{property.nights}</td>
                  <td className="text-right px-4 py-3 tabular-nums">{property.occupancy}%</td>
                  <td className="text-right px-4 py-3 tabular-nums">€{fmt(property.avgRate)}</td>
                  <td className="text-right px-4 py-3 tabular-nums text-red-500">-€{fmt(property.cleaningCost)}</td>
                  <td className={`text-right px-4 py-3 tabular-nums font-semibold ${property.net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {property.net >= 0 ? '+' : ''}€{fmt(property.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
