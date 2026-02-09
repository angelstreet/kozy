import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';

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

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Calendar() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Detect mobile for default view
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() =>
    window.innerWidth < 640 ? 'week' : 'month'
  );

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();

  useEffect(() => {
    if (!isEmpty) {
      apiFetch('/bookings').then(r => r.json()).then(d => setBookings(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isEmpty]);

  // Week view helpers
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate.toDateString()]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' });
  const dayNames = lang === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getBookingsForDate = (ds: string) =>
    bookings.filter(b => ds >= b.checkin_date && ds < b.checkout_date);

  const getBookingsForDay = (day: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return getBookingsForDate(ds);
  };

  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">{t('calendar', lang)}</h1>
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

  // Week range label
  const weekLabel = `${weekDays[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="p-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">{t('calendar', lang)}</h1>
        <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
          >
            <CalendarIcon size={14} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={viewMode === 'week' ? prevWeek : prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-semibold capitalize">
          {viewMode === 'week' ? weekLabel : monthName}
        </span>
        <button onClick={viewMode === 'week' ? nextWeek : nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="space-y-1">
          {weekDays.map(day => {
            const ds = dateStr(day);
            const dayBookings = getBookingsForDate(ds);
            const isT = isSameDay(day, today);
            return (
              <div
                key={ds}
                className={`rounded-xl p-3 ${isT ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/30' : 'bg-white dark:bg-gray-800'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${isT ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400'}`}>
                    {day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}
                  </span>
                  {dayBookings.length === 0 && <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
                </div>
                {dayBookings.length > 0 && (
                  <div className="space-y-1">
                    {dayBookings.map(b => (
                      <div
                        key={b.id}
                        className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5"
                        style={{ backgroundColor: (b.property_color || '#3B82F6') + '20' }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.property_color || '#3B82F6' }} />
                        <span className="font-medium truncate">{b.guest_name || '—'}</span>
                        <span className="text-gray-400 truncate ml-auto">{b.property_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {dayNames.map(d => (
            <div key={d} className="bg-gray-50 dark:bg-gray-800 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white dark:bg-gray-900 min-h-[60px] sm:min-h-[80px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayBookings = getBookingsForDay(day);
            return (
              <div key={day} className={`bg-white dark:bg-gray-900 min-h-[60px] sm:min-h-[80px] p-1 ${isToday(day) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}>
                <span className={`text-xs font-medium ${isToday(day) ? 'text-blue-600 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>{day}</span>
                <div className="mt-0.5 space-y-0.5">
                  {dayBookings.slice(0, 2).map(b => (
                    <div key={b.id} className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: b.property_color || '#3B82F6' }}>
                      {b.guest_name || b.property_name}
                    </div>
                  ))}
                  {dayBookings.length > 2 && <div className="text-[10px] text-gray-400">+{dayBookings.length - 2}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {properties.map((p: any) => (
          <div key={p.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: p.color || '#3B82F6' }} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
