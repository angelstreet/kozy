import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';

export default function Payments() {
  const { lang } = useApp();
  const { loading, isEmpty } = useProperties();

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('payments', lang)}</h1>
        <EmptyState
          emoji="💰"
          title="Nothing to track yet"
          subtitle="Payment tracking will appear here once you have properties and cleanings scheduled."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{t('payments', lang)}</h1>
      <p className="mt-2 text-gray-500">Payment tracking coming soon...</p>
    </div>
  );
}
