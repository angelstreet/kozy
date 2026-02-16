import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, X, Filter, BarChart3, Clock } from 'lucide-react';

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

// Source-based colors
function getSourceColor(source: string): string {
  if (source === 'airbnb') return '#EF4444'; // red
  if (source === 'booking' || source === 'booking.com') return '#3B82F6'; // blue
  if (source === 'smoobu') return '#10B981'; // green
  return '#6B7280'; // gray fallback
}

function getSourceLabel(source: string): string {
  if (source === 'airbnb') return 'Airbnb';
  if (source === 'booking' || source === 'booking.com') return 'Booking.com';
  if (source === 'smoobu') return 'Smoobu';
  return source;
}

// Clean guest name (remove technical fields and extract real names)
function cleanGuestName(name: string): string {
  if (!name) return 'Reservation';

  // Remove language codes like "language: es", "language: fr", "language: fr-CA" etc.
  if (/^language:\s*[a-z]{2}(-[A-Z]{2})?$/i.test(name.trim())) {
    return 'Reservation';
  }

  // Remove "message:" prefix
  let cleaned = name.replace(/^message:\s*/i, '').trim();

  // If it starts with "Check-in" or "Check-out", extract the name after
  if (/^(Check-in|Check-out)\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(Check-in|Check-out)\s+/i, '').trim();
    // Remove property name suffix (everything after ", " if it looks like a property)
    const parts = cleaned.split(',');
    if (parts.length > 1 && parts[1].includes('Maison')) {
      return parts[0].trim() || 'Reservation';
    }
    return cleaned.split(',')[0].trim() || 'Reservation';
  }

  // If it contains property name suffix, extract just the guest name
  if (cleaned.includes(', Maison') || cleaned.includes(', Villa') || cleaned.includes(', T2 ') || cleaned.includes(', Appartement')) {
    return cleaned.split(',')[0].trim() || 'Reservation';
  }

  // If it's a long message with RESERVATION/BOOKING NOTE, try to extract a real name
  if (cleaned.length > 50 || cleaned.includes('RESERVATION') || cleaned.includes('BOOKING NOTE')) {
    // Try to find a capitalized name pattern (First Last or First Middle Last)
    const nameMatch = cleaned.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\b/);
    if (nameMatch) return nameMatch[1];
    return 'Reservation';
  }

  // Take first line or until comma, but check if it looks like a real name
  const firstPart = cleaned.split(/[\n,]/)[0].trim();

  // If it's still prefixed with ** or looks like system text, return generic
  if (firstPart.startsWith('**') || firstPart.toUpperCase() === firstPart) {
    return 'Reservation';
  }

  return firstPart || 'Reservation';
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

// Check if booking starts on this date
function bookingStartsOn(booking: Booking, dateString: string): boolean {
  return booking.checkin_date === dateString;
}

// Check if booking is ongoing (middle of stay) on this date
function bookingContinuesOn(booking: Booking, dateString: string): boolean {
  return dateString > booking.checkin_date && dateString < booking.checkout_date;
}

// Modal component for booking details
function BookingModal({ booking, onClose, lang }: { booking: Booking; onClose: () => void; lang: string }) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const checkin = new Date(booking.checkin_date);
  const checkout = new Date(booking.checkout_date);
  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold">{t('booking_details', lang) || 'Booking Details'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">{lang === 'fr' ? 'Voyageur' : 'Guest'}</div>
            <div className="font-semibold text-lg">{cleanGuestName(booking.guest_name)}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-1">{lang === 'fr' ? 'Propriété' : 'Property'}</div>
            <div className="font-medium">{booking.property_name}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">{lang === 'fr' ? 'Arrivée' : 'Check-in'}</div>
              <div className="font-medium">{checkin.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">{lang === 'fr' ? 'Départ' : 'Check-out'}</div>
              <div className="font-medium">{checkout.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-1">{lang === 'fr' ? 'Durée' : 'Duration'}</div>
            <div className="font-medium">{nights} {lang === 'fr' ? (nights > 1 ? 'nuits' : 'nuit') : (nights > 1 ? 'nights' : 'night')}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-1">Source</div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: getSourceColor(booking.source) }}>
              <div className="w-2 h-2 rounded-full bg-white/80" />
              {getSourceLabel(booking.source)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'timeline'>(() =>
    window.innerWidth < 640 ? 'week' : 'timeline'
  );

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640 && viewMode === 'timeline') {
        setViewMode('week');
      } else if (window.innerWidth >= 640 && viewMode === 'week') {
        setViewMode('timeline');
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

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

  // Filter bookings by selected property
  // Deduplicate bookings: group by property_id + checkin_date + checkout_date
  // Keep the entry with the best guest name (real name > system text)
  const deduplicatedBookings = useMemo(() => {
    const groups = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = `${b.property_id}|${b.checkin_date}|${b.checkout_date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }

    const isNoise = (name: string) => {
      if (!name) return true;
      const n = name.trim();
      if (/^language:\s/i.test(n)) return true;
      if (/^message:\s/i.test(n)) return true;
      if (/^Check-(in|out)\s/i.test(n)) return true;
      return false;
    };

    const result: Booking[] = [];
    for (const group of groups.values()) {
      // Prefer entry with a real guest name
      const best = group.find(b => !isNoise(b.guest_name)) || group[0];
      result.push(best);
    }
    return result;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (!selectedPropertyId) return deduplicatedBookings;
    return deduplicatedBookings.filter(b => b.property_id === selectedPropertyId);
  }, [deduplicatedBookings, selectedPropertyId]);

  const timelineBookings = deduplicatedBookings;

  const timelineStartDate = useMemo(() => {
    const fdow = getFirstDayOfWeek(year, month);
    const start = new Date(year, month, 1 - fdow);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [year, month]);

  const timelineDays = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(timelineStartDate);
      d.setDate(timelineStartDate.getDate() + i);
      return d;
    });
  }, [timelineStartDate]);

  const TOTAL_TIMELINE_DAYS = 42;

  const propertyData = useMemo(() => {
    return properties.map((p: any) => ({
      property: p,
      bookings: timelineBookings.filter((b: Booking) => b.property_id === p.id)
        .sort((a: Booking, b: Booking) => a.checkin_date.localeCompare(b.checkin_date))
    }));
  }, [properties, timelineBookings]);

  const nextCheckins = useMemo(() => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return deduplicatedBookings
      .filter((b: Booking) => new Date(b.checkin_date) >= todayMidnight)
      .sort((a: Booking, b: Booking) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime());
  }, [deduplicatedBookings]);

  const timelineLabel = useMemo(() => {
    if (!timelineDays.length) return '';
    const startStr = timelineDays[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const endStr = timelineDays[timelineDays.length - 1].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [timelineDays, locale]);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate.toDateString()]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const startStr = weekDays[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const endStr = weekDays[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [weekDays, locale]);
  const monthName = useMemo(() => currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' }), [currentDate, locale]);

  const periodLabel = useMemo(() => viewMode === 'week' ? weekLabel : viewMode === 'month' ? monthName : timelineLabel, [viewMode, weekLabel, monthName, timelineLabel]);

  const calculateBarPosition = (booking: Booking, startDate: Date, dayWidth = 44) => {
    const msPerDay = 86400000;
    const startMs = startDate.getTime();
    const checkinMs = new Date(booking.checkin_date).getTime();
    const checkoutMs = new Date(booking.checkout_date).getTime();
    const leftDays = (checkinMs - startMs) / msPerDay;
    const durDays = (checkoutMs - checkinMs) / msPerDay;
    let leftPx = Math.max(0, leftDays * dayWidth);
    let widthPx = durDays * dayWidth;
    const totalDays = TOTAL_TIMELINE_DAYS;
    const totalWidth = totalDays * dayWidth;
    if (leftPx + widthPx > totalWidth) {
      widthPx = totalWidth - leftPx;
    }
    const isLeftClip = leftDays < 0;
    const isRightClip = checkoutMs > startMs + totalDays * msPerDay;
    if (isLeftClip) leftPx = 0;
    if (widthPx < 20) return {left: 0, width: 0, isLeftClip: false, isRightClip: false};
    return {left: leftPx, width: widthPx, isLeftClip, isRightClip};
  };

  // Week view helpers

  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const goPrev = () => {
    if (viewMode === 'month') {
      prevMonth();
    } else {
      prevWeek();
    }
  };

  const goNext = () => {
    if (viewMode === 'month') {
      nextMonth();
    } else {
      nextWeek();
    }
  };

  const dayNames = lang === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const shortDayNames = dayNames.map(d => d.slice(0,2));

  const getBookingsForDate = (ds: string) =>
    filteredBookings.filter(b => ds >= b.checkin_date && ds < b.checkout_date);

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

  // Calculate total cells needed for month view (always show 6 weeks = 42 cells)
  const totalCells = 42;
  const trailingCells = totalCells - firstDay - daysInMonth;

  return (
    <div className="p-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">{t('calendar', lang)}</h1>
        <div className="flex rounded-lg border dark:border-gray-600 overflow-hidden">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <CalendarIcon size={14} />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </div>

      {/* Property Filter Bar */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2">
        <Filter size={16} className="text-gray-400 flex-shrink-0" />
        <button
          onClick={() => setSelectedPropertyId(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            !selectedPropertyId
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {lang === 'fr' ? 'Toutes' : 'All'}
        </button>
        {properties.map((p: any) => (
          <button
            key={p.id}
            onClick={() => setSelectedPropertyId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedPropertyId === p.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={goPrev} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-semibold capitalize">
          {periodLabel}
        </span>
        <button onClick={goNext} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
                  {dayBookings.length === 0 && <span className="text-[10px] text-gray-300 dark:text-gray-600">-</span>}
                </div>
                {dayBookings.length > 0 && (
                  <div className="space-y-1">
                    {dayBookings.map(b => {
                      const sourceColor = getSourceColor(b.source);
                      const guestName = cleanGuestName(b.guest_name);
                      const isStart = bookingStartsOn(b, ds);
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: sourceColor + '20' }}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sourceColor }} />
                          <span className="font-medium truncate">{isStart ? guestName : '→ ' + guestName}</span>
                          <span className="text-gray-400 truncate ml-auto text-[10px]">{b.property_name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month View with Continuation Indicators */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {dayNames.map(d => (
            <div key={d} className="bg-gray-50 dark:bg-gray-800 text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}

          {/* Previous month trailing days */}
          {Array.from({ length: firstDay }).map((_, i) => {
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const prevMonthDays = getDaysInMonth(prevYear, prevMonth);
            const day = prevMonthDays - firstDay + i + 1;
            const ds = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = getBookingsForDate(ds);

            return (
              <div key={`prev-${i}`} className="bg-gray-50 dark:bg-gray-950 min-h-[80px] sm:min-h-[100px] p-2 opacity-40">
                <div className="text-sm font-semibold mb-1 text-gray-400">{day}</div>
                <div className="space-y-1">
                  {dayBookings.map(booking => {
                    const sourceColor = getSourceColor(booking.source);
                    const guestName = cleanGuestName(booking.guest_name);
                    const isStart = bookingStartsOn(booking, ds);
                    const isContinuation = bookingContinuesOn(booking, ds);

                    return (
                      <div
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className="text-[10px] sm:text-xs leading-tight px-2 py-1 rounded text-white font-medium cursor-pointer hover:opacity-90 transition-opacity truncate flex items-center gap-1"
                        style={{ backgroundColor: sourceColor }}
                        title={`${guestName} - ${booking.property_name}`}
                      >
                        {isContinuation && <span>→</span>}
                        {isStart ? guestName : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Current month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = getBookingsForDay(day);

            return (
              <div
                key={day}
                className={`bg-white dark:bg-gray-900 min-h-[80px] sm:min-h-[100px] p-2 relative ${isToday(day) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                {/* Date number in top-left corner */}
                <div className={`text-sm font-semibold mb-1 ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {day}
                </div>

                {/* Bookings with continuation indicators */}
                <div className="space-y-1">
                  {dayBookings.map(booking => {
                    const sourceColor = getSourceColor(booking.source);
                    const guestName = cleanGuestName(booking.guest_name);
                    const isStart = bookingStartsOn(booking, ds);
                    const isContinuation = bookingContinuesOn(booking, ds);

                    return (
                      <div
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className="text-[10px] sm:text-xs leading-tight px-2 py-1 rounded text-white font-medium cursor-pointer hover:opacity-90 transition-opacity truncate flex items-center gap-1"
                        style={{ backgroundColor: sourceColor }}
                        title={`${guestName} - ${booking.property_name}`}
                      >
                        {isContinuation && <span>→</span>}
                        {isStart ? guestName : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Next month leading days */}
          {Array.from({ length: trailingCells }).map((_, i) => {
            const day = i + 1;
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const ds = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = getBookingsForDate(ds);

            return (
              <div key={`next-${i}`} className="bg-gray-50 dark:bg-gray-950 min-h-[80px] sm:min-h-[100px] p-2 opacity-40">
                <div className="text-sm font-semibold mb-1 text-gray-400">{day}</div>
                <div className="space-y-1">
                  {dayBookings.map(booking => {
                    const sourceColor = getSourceColor(booking.source);
                    const guestName = cleanGuestName(booking.guest_name);
                    const isStart = bookingStartsOn(booking, ds);
                    const isContinuation = bookingContinuesOn(booking, ds);

                    return (
                      <div
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className="text-[10px] sm:text-xs leading-tight px-2 py-1 rounded text-white font-medium cursor-pointer hover:opacity-90 transition-opacity truncate flex items-center gap-1"
                        style={{ backgroundColor: sourceColor }}
                        title={`${guestName} - ${booking.property_name}`}
                      >
                        {isContinuation && <span>→</span>}
                        {isStart ? guestName : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <>
          <div className="mb-6 overflow-x-auto rounded-lg border shadow-sm">
            <div className="min-w-max">
              <div 
                className="grid gap-px bg-gray-300 dark:bg-gray-600 rounded-xl p-2 shadow-inner"
                style={{
                  gridTemplateColumns: '140px repeat(42,44px)'
                }}
              >
                {/* Property header */}
                <div 
                  className="sticky left-0 top-0 z-40 p-3 font-bold text-sm bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-r border-gray-300 dark:border-gray-600 shadow-sm rounded-l-xl text-gray-900 dark:text-gray-100"
                  style={{ gridRow: 1, gridColumn: 1 }}
                >
                  Properties
                </div>
                {/* Date headers */}
                {timelineDays.map((day, idx) => (
                  <div
                    key={`head-${idx}`}
                    className={`min-h-[48px] flex flex-col items-center justify-center p-1 text-xs font-medium border-b transition-colors ${isSameDay(day, today) ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-inner font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    style={{
                      gridRow: 1,
                      gridColumn: idx + 2
                    }}
                  >
                    <span className="font-mono text-lg">{day.getDate()}</span>
                    <span className="text-[9px] opacity-75 uppercase tracking-wider">{shortDayNames[day.getDay()]}</span>
                  </div>
                ))}
                {/* Property rows */}
                {propertyData.map(({property, bookings}, pIdx) => {
                  const rowNum = pIdx + 2;
                  return (
                    <>
                      <div
                        key={`prop-${property.id}`}
                        className="sticky left-0 z-20 bg-white dark:bg-gray-900 p-2.5 pr-3 text-sm font-semibold border-r border-b border-gray-200 dark:border-gray-700 shadow-sm bg-opacity-95 backdrop-blur rounded-l-lg flex items-center gap-2"
                        style={{
                          gridRow: rowNum,
                          gridColumn: 1
                        }}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shadow-md ring-white/50 flex-shrink-0"
                          style={{ backgroundColor: property.color || '#9CA3AF' }}
                        />
                        <span className="truncate">{property.name}</span>
                      </div>
                      <div
                        key={`row-${property.id}`}
                        className="relative h-[56px] border-b border-gray-200 dark:border-gray-700 overflow-hidden bg-gradient-to-r from-white/60 to-gray-50/60 dark:from-gray-900/60"
                        style={{
                          gridRow: rowNum,
                          gridColumn: '2 / 44'
                        }}
                      >
                        {bookings.map((booking, bIdx) => {
                          const pos = calculateBarPosition(booking, timelineStartDate);
                          if (pos.width < 20) return null;
                          const guestName = cleanGuestName(booking.guest_name);
                          const sourceColor = getSourceColor(booking.source);
                          const isLeftClip = pos.isLeftClip;
                          const isRightClip = pos.isRightClip;
                          return (
                            <div
                              key={booking.id}
                              className="absolute inset-y-1.5 px-2 py-1 rounded-xl flex items-center gap-1.5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-[1.02] hover:z-10 transition-all duration-200 cursor-pointer overflow-hidden min-h-[26px]"
                              style={{
                                left: `${pos.left}px`,
                                width: `${pos.width}px`,
                                backgroundColor: sourceColor,
                                transform: `translateY(${bIdx * 4}px)`
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBooking(booking);
                              }}
                              title={`${guestName} | ${getSourceLabel(booking.source)} | ${booking.checkin_date} → ${booking.checkout_date}`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-white/95 shadow flex-shrink-0" />
                              <span className="truncate text-[11px] font-medium text-white leading-tight">
                                {isLeftClip && <span className="opacity-80 mr-1 whitespace-nowrap">↢ </span>}
                                {guestName.slice(0,24)}
                                {isRightClip && <span className="opacity-80 ml-1 whitespace-nowrap"> ↢</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upcoming events panel */}
          <div className="mt-8 p-6 rounded-2xl border shadow-xl bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-indigo-100 dark:border-gray-700">
              <Clock className="w-8 h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                {lang === 'fr' ? 'Prochains check-ins' : 'Upcoming Check-ins'}
              </h3>
              <span className="ml-auto text-sm font-semibold text-gray-600 dark:text-gray-400">({Math.min(5, nextCheckins.length)})</span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto -m-1 p-1">
              {nextCheckins.slice(0,5).map((booking) => {
                const checkinDate = new Date(booking.checkin_date);
                const nights = Math.ceil((new Date(booking.checkout_date).getTime() - checkinDate.getTime()) / 86400000);
                return (
                  <div
                    key={booking.id}
                    className="group flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-600 transition-all duration-300 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <div className="flex-shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-white font-bold shadow-2xl ring-2 ring-white/20" style={{backgroundColor: getSourceColor(booking.source)}}>
                      <div className="text-2xl drop-shadow-md">{checkinDate.getDate()}</div>
                      <div className="text-xs opacity-90 uppercase tracking-wide drop-shadow-md">{shortDayNames[checkinDate.getDay()]}</div>
                      <div className="text-[10px] tracking-wide drop-shadow-md">{checkinDate.toLocaleDateString(locale, {month: 'short'})}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xl truncate text-gray-900 dark:text-gray-100">{cleanGuestName(booking.guest_name)}</h4>
                      <p className="text-base text-gray-600 dark:text-gray-400 mb-2 truncate max-w-none">{booking.property_name}</p>
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow-lg" style={{backgroundColor: getSourceColor(booking.source)}}>
                          <div className="w-2.5 h-2.5 rounded-full bg-white shadow" />
                          {getSourceLabel(booking.source)}
                        </div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300 ml-auto">
                          {nights} <span className="text-sm font-normal">{lang === 'fr' ? (nights > 1 ? 'nuits' : 'nuit') : (nights > 1 ? 'nights' : 'night')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {nextCheckins.length === 0 && (
                <div className="p-16 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <CalendarIcon className="w-20 h-20 mx-auto mb-6 text-gray-400" />
                  <h4 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">{lang === 'fr' ? 'Aucune réservation à venir' : 'No upcoming reservations'}</h4>
                  <p className="text-gray-500 dark:text-gray-400">{lang === 'fr' ? 'Profitez de la tranquillité !' : 'Enjoy the calm period!'}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {/* Legend */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#EF4444' }} />
            <span>Airbnb</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#3B82F6' }} />
            <span>Booking.com</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#10B981' }} />
            <span>Smoobu</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          → = {lang === 'fr' ? 'Continuation du séjour' : 'Continuation of stay'}
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          lang={lang}
        />
      )}
    </div>
  );
}
