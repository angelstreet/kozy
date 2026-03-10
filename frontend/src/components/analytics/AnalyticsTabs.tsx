import { AnalyticsTab } from './types';

type Props = {
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
  lang: string;
};

const TABS: Array<{ key: AnalyticsTab; en: string; fr: string }> = [
  { key: 'earnings', en: 'Earnings', fr: 'Revenus' },
  { key: 'performance', en: 'Performance', fr: 'Performance' },
  { key: 'quality', en: 'Quality', fr: 'Qualite' },
  { key: 'reports', en: 'Reports', fr: 'Rapports' },
];

export default function AnalyticsTabs({ activeTab, onChange, lang }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {lang === 'fr' ? tab.fr : tab.en}
          </button>
        ))}
      </div>
    </div>
  );
}
