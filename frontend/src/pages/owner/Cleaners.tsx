import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';

export default function Cleaners() {
  const { lang } = useApp();
  const { loading, isEmpty } = useProperties();

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('cleaners', lang)}</h1>
        <EmptyState
          emoji="🧹"
          title="Add a property first"
          subtitle="Once you have a property, you can invite your cleaners and assign them."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{t('cleaners', lang)}</h1>
      <p className="mt-2 text-gray-500">Cleaner management coming soon...</p>
    </div>
  );
}
