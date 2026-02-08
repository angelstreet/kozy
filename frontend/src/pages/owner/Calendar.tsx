import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Booking {
  id: number;
  property_id: number;
  checkin_date: string;
  checkout_date: string;
  guest_name: string;
  source: string;
  property_name: string;
  property_color: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday-start
}

export default function Calendar() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  useEffect(() => {
    if (!isEmpty) {
      apiFetch('/bookings').then(r => r.json()).then(d => setBookings(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isEmpty]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });
  const dayNames = lang === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getBookingsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => dateStr >= b.checkin_date && dateStr < b.checkout_date);
  };

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('calendar', lang)}</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft size={20} /></button>
        <span className="text-lg font-semibold capitalize">{monthName}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {dayNames.map(d => (
          <div key={d} className="bg-gray-50 dark:bg-gray-800 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white dark:bg-gray-900 min-h-[80px]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayBookings = getBookingsForDay(day);
          return (
            <div key={day} className={`bg-white dark:bg-gray-900 min-h-[80px] p-1 ${isToday(day) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}>
              <span className={`text-xs font-medium ${isToday(day) ? 'text-blue-600 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayBookings.slice(0, 3).map(b => (
                  <div key={b.id} className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: b.property_color || '#3B82F6' }}>
                    {b.guest_name || b.property_name}
                  </div>
                ))}
                {dayBookings.length > 3 && <div className="text-[10px] text-gray-400">+{dayBookings.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {properties.map((p: any) => (
          <div key={p.id} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color || '#3B82F6' }} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
