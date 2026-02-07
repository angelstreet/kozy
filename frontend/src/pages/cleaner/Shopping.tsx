import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import EmptyState from '@/components/EmptyState';

export default function Shopping() {
  const { lang } = useApp();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('shopping', lang)}</h1>
      <EmptyState
        emoji="🛒"
        title="No requests yet"
        subtitle="Shopping requests from your properties will appear here."
      />
    </div>
  );
}
