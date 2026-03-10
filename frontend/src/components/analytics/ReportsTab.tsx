type ReportSummary = {
  label: string;
  value: string;
  hint: string;
};

type Props = {
  lang: string;
  reportSummary: ReportSummary[];
  onExportBookings: () => void;
  onExportProperties: () => void;
  onExportRevenue: () => void;
};

export default function ReportsTab({
  lang,
  reportSummary,
  onExportBookings,
  onExportProperties,
  onExportRevenue,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
          {lang === 'fr' ? 'Rapports' : 'Reports'}
        </p>
        <h2 className="text-2xl font-semibold mt-2 text-gray-900 dark:text-white">
          {lang === 'fr' ? 'Exports operationnels pour cette vue' : 'Operational exports for this view'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-3xl">
          {lang === 'fr'
            ? 'Cette section donne les exports utiles tout de suite. Les PDF et rapports planifies pourront venir ensuite sans rebouger toute la page.'
            : 'This section provides the useful exports immediately. PDF statements and scheduled reports can come later without rebuilding the whole page.'}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reportSummary.map(item => (
          <div key={item.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</p>
            <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{item.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onExportBookings}
          className="text-left bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
        >
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
            {lang === 'fr' ? 'CSV' : 'CSV'}
          </p>
          <p className="text-lg font-semibold mt-2 text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Exporter les reservations' : 'Export bookings'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {lang === 'fr' ? 'Une ligne par reservation visible avec dates, source, nuits et revenu.' : 'One row per visible booking with dates, source, nights, and revenue.'}
          </p>
        </button>

        <button
          type="button"
          onClick={onExportProperties}
          className="text-left bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
        >
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
            {lang === 'fr' ? 'CSV' : 'CSV'}
          </p>
          <p className="text-lg font-semibold mt-2 text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Exporter par propriete' : 'Export property summary'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {lang === 'fr' ? 'Synthese portefeuille avec occupation, ADR, menage et net.' : 'Portfolio summary with occupancy, ADR, cleaning, and net.'}
          </p>
        </button>

        <button
          type="button"
          onClick={onExportRevenue}
          className="text-left bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
        >
          <p className="text-xs text-gray-400 uppercase tracking-[0.2em]">
            {lang === 'fr' ? 'CSV' : 'CSV'}
          </p>
          <p className="text-lg font-semibold mt-2 text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Exporter revenus mensuels' : 'Export monthly revenue'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {lang === 'fr' ? 'Histogramme exporte avec une ligne par mois et les colonnes par propriete.' : 'Histogram export with one row per month and columns per property.'}
          </p>
        </button>
      </div>
    </div>
  );
}
