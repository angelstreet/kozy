import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';

export default function Calendar() {
  const { lang } = useApp();
  const { loading, isEmpty } = useProperties();

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('calendar', lang)}</h1>
        <EmptyState
          emoji="📅"
          title="No properties yet"
          subtitle="Add a property and connect your Airbnb/Booking calendars to see bookings here."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{t('calendar', lang)}</h1>
      <p className="mt-2 text-gray-500">Calendar view coming soon...</p>
    </div>
  );
}
