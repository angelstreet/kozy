import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function Properties() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const navigate = useNavigate();

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('properties', lang)}</h1>
        <EmptyState
          emoji="🏘️"
          title="No properties yet"
          subtitle="Add your first rental property to get started with Kozy."
          ctaLabel="+ Add Property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('properties', lang)}</h1>
        <button
          onClick={() => navigate('/add-property')}
          className="bg-blue-500 text-white p-2 rounded-xl shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-3">
        {properties.map(p => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
              <h3 className="font-bold text-lg">{p.name}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-2">{p.address}</p>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>🕐 Out {p.checkout_time} / In {p.checkin_time}</span>
              <span>€{p.rate}/clean</span>
            </div>
            <div className="flex gap-2 mt-2">
              {p.ical_airbnb && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Airbnb</span>}
              {p.ical_booking && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Booking</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
