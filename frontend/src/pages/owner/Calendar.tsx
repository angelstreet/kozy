import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Users,
  Moon,
  TrendingUp,
  X,
  Search,
  Home,
  LogIn,
  LogOut,
  BarChart3
} from 'lucide-react';

interface Booking {
  id: number;
  property_id: number;
  checkin_date: string;
  checkout_date: string;
  guest_name: string;
  source: string;
  property_name: string;
  property_color: string;
  status?: string;
}

// Source-based colors (muted pastels)
function getSourceColor(source: string): string {
  const norm = normalizeSource(source);
  if (norm === 'airbnb') return '#E8927C';
  if (norm === 'booking') return '#7C9FE8';
  if (norm === 'smoobu' || norm === 'direct') return '#7CC5A8';
  return '#9CA3AF';
}

function getSourceInitial(source: string): string {
  const norm = normalizeSource(source);
  if (norm === 'airbnb') return 'A.';
  if (norm === 'booking') return 'B.';
  if (norm === 'smoobu') return 'S.';
  if (norm === 'direct') return 'D.';
  return '?';
}

function getSourceLabel(source: string): string {
  const norm = normalizeSource(source);
  if (norm === 'airbnb') return 'Airbnb';
  if (norm === 'booking') return 'Booking.com';
  if (norm === 'smoobu') return 'Smoobu';
  if (norm === 'direct') return 'Direct';
  return source;
}

function normalizeSource(source: string): string {
  const lower = source.toLowerCase().trim();
  if (lower === 'airbnb') return 'airbnb';
  if (lower.includes('booking')) return 'booking';
  if (lower === 'smoobu') return 'smoobu';
  if (lower.includes('direct')) return 'direct';
  return lower;
}

// Clean guest name (remove technical fields and extract real names)
function cleanGuestName(name: string): string {
  if (!name) return 'Reservation';

  // Remove language codes
  if (/^language:\s*[a-z]{2}(-[A-Z]{2})?$/i.test(name.trim())) {
    return 'Reservation';
  }

  // Remove "message:" prefix
  let cleaned = name.replace(/^message:\s*/i, '').trim();

  // If it starts with "Check-in" or "Check-out", extract the name after
  if (/^(Check-in|Check-out)\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(Check-in|Check-out)\s+/i, '').trim();
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

  // If it's a long message, try to extract a real name
  if (cleaned.length > 50 || cleaned.includes('RESERVATION') || cleaned.includes('BOOKING NOTE')) {
    const nameMatch = cleaned.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\b/);
    if (nameMatch) return nameMatch[1];
    return 'Reservation';
  }

  const firstPart = cleaned.split(/[\n,]/)[0].trim();

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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Booking Popover Component - centered modal
function BookingPopover({
  booking,
  onClose,
  lang
}: {
  booking: Booking;
  onClose: () => void;
  lang: string
}) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const checkin = new Date(booking.checkin_date);
  const checkout = new Date(booking.checkout_date);
  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-80"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {cleanGuestName(booking.guest_name)}
        </h3>
        <button 
          onClick={onClose} 
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: getSourceColor(booking.source) }}
          >
            {getSourceInitial(booking.source).replace('.', '')}
          </div>
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
            {getSourceLabel(booking.source)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Users size={14} />
          <span>5 {lang === 'fr' ? 'voyageurs' : 'guests'}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Moon size={14} />
          <span>{nights} {lang === 'fr' ? (nights > 1 ? 'nuits' : 'nuit') : (nights > 1 ? 'nights' : 'night')}</span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{lang === 'fr' ? 'Arrivée' : 'From'}</span>
            <div className="text-right">
              <div className="font-medium text-gray-900 dark:text-white">
                {checkin.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div className="text-xs text-gray-500">(16:00)</div>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{lang === 'fr' ? 'Départ' : 'To'}</span>
            <div className="text-right">
              <div className="font-medium text-gray-900 dark:text-white">
                {checkout.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div className="text-xs text-gray-500">(12:00)</div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp size={14} className="text-gray-500" />
            <span className="text-gray-500">{lang === 'fr' ? 'Valeur du paiement' : 'Payout value'}</span>
            <span className="ml-auto font-bold text-gray-900 dark:text-white">730.41</span>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <button className="w-full px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
            {lang === 'fr' ? 'Voir plus' : 'View more'}
          </button>
          <button className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {lang === 'fr' ? 'Modifier la réservation' : 'Edit booking'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// 3-month calendar sub-component
function MonthGrid({
  year,
  month,
  filteredBookings,
  propertySlotMap,
  numPropertySlots,
  today,
  dayNames,
  lang,
  onBookingClick,
}: {
  year: number;
  month: number;
  filteredBookings: Booking[];
  propertySlotMap: Map<number, number>;
  numPropertySlots: number;
  today: Date;
  dayNames: string[];
  lang: string;
  onBookingClick: (booking: Booking, event: React.MouseEvent) => void;
}) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const totalCells = 42;
    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];
    const prevMo = month === 0 ? 11 : month - 1;
    const prevYr = month === 0 ? year - 1 : year;
    const prevMoDays = getDaysInMonth(prevYr, prevMo);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(prevYr, prevMo, prevMoDays - i), isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    const nextMo = month === 11 ? 0 : month + 1;
    const nextYr = month === 11 ? year + 1 : year;
    const remaining = totalCells - days.length;
    for (let day = 1; day <= remaining; day++) {
      days.push({ date: new Date(nextYr, nextMo, day), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const weeks = useMemo(() => {
    const result: Array<typeof calendarDays> = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const weekBookingBars = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0]?.date;
      const weekEnd = week[6]?.date;
      if (!weekStart || !weekEnd) return [];
      const pad = (n: number) => String(n).padStart(2, '0');
      const weekStartStr = `${weekStart.getFullYear()}-${pad(weekStart.getMonth()+1)}-${pad(weekStart.getDate())}`;
      const weekEndStr = `${weekEnd.getFullYear()}-${pad(weekEnd.getMonth()+1)}-${pad(weekEnd.getDate())}`;

      const overlapping = filteredBookings.filter(b => b.checkin_date <= weekEndStr && b.checkout_date > weekStartStr);

      const bars = overlapping.map(booking => {
        const checkin = new Date(booking.checkin_date);
        const checkout = new Date(booking.checkout_date);
        let startDayIdx = 0;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && isSameDay(d, checkin)) { startDayIdx = i; break; }
        }
        if (checkin < weekStart) startDayIdx = 0;

        let endPos = 7;
        let isCheckoutDay = false;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && isSameDay(d, checkout)) { endPos = i; isCheckoutDay = true; break; }
        }
        if (!isCheckoutDay && checkout > new Date(weekEnd.getTime() + 86400000)) endPos = 7;

        const checkinStr = booking.checkin_date;
        const checkoutStr = booking.checkout_date;
        const hasHandoff = isCheckoutDay && filteredBookings.some(other => other.id !== booking.id && other.checkin_date === checkoutStr);
        let isCheckinInWeek = false;
        let checkinDayIdx = startDayIdx;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && isSameDay(d, checkin)) { isCheckinInWeek = true; checkinDayIdx = i; break; }
        }
        const hasIncomingHandoff = isCheckinInWeek && filteredBookings.some(other => other.id !== booking.id && other.checkout_date === checkinStr);

        let leftPercent = (startDayIdx / 7) * 100;
        let rightEdge: number;
        if (hasHandoff && isCheckoutDay) rightEdge = ((endPos + 0.5) / 7) * 100;
        else if (isCheckoutDay) rightEdge = (endPos / 7) * 100;
        else rightEdge = (endPos / 7) * 100;
        if (hasIncomingHandoff && isCheckinInWeek) leftPercent = ((checkinDayIdx + 0.5) / 7) * 100;
        let widthPercent = rightEdge - leftPercent;
        if (widthPercent < 0) widthPercent = 0;
        const slot = propertySlotMap.get(booking.property_id) ?? 0;

        return { booking, leftPercent, widthPercent, slot, startDayIdx, isCheckoutDay, hasHandoff, hasIncomingHandoff };
      }).filter(bar => bar.widthPercent > 0);

      // Assign lanes to prevent horizontal overlap within the same week row
      bars.sort((a, b) => a.leftPercent - b.leftPercent);
      const laneOccupancy: Array<Array<{ leftPercent: number; widthPercent: number }>> = [];
      return bars.map(bar => {
        let lane = 0;
        while (true) {
          const occupied = laneOccupancy[lane] ?? [];
          const overlaps = occupied.some(other =>
            bar.leftPercent < other.leftPercent + other.widthPercent &&
            bar.leftPercent + bar.widthPercent > other.leftPercent
          );
          if (!overlaps) break;
          lane++;
        }
        if (!laneOccupancy[lane]) laneOccupancy[lane] = [];
        laneOccupancy[lane].push({ leftPercent: bar.leftPercent, widthPercent: bar.widthPercent });
        return { ...bar, lane };
      });
    });
  }, [weeks, filteredBookings, propertySlotMap]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-2.5">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {new Date(year, month).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </h2>
      </div>
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        {dayNames.map((day, idx) => (
          <div key={day} className={`text-center text-[10px] font-semibold py-1.5 ${idx >= 5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {day}
          </div>
        ))}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {weeks.map((week, weekIdx) => {
          const maxLanes = Math.max(1, ...(weekBookingBars[weekIdx]?.map(b => (b.lane ?? 0) + 1) ?? [1]));
          const rowMinHeight = Math.max(56, 22 + maxLanes * 22 + 6);
          return (
            <div key={weekIdx} className="grid grid-cols-7 relative" style={{ minHeight: `${rowMinHeight}px` }}>
              {week.map((cell, dayIdx) => {
                if (!cell.date) return <div key={dayIdx} className="border-r border-gray-50 dark:border-gray-800" />;
                const isToday = cell.date.toDateString() === today.toDateString();
                const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
                return (
                  <div key={dayIdx} className={`relative p-1 border-r border-gray-50 dark:border-gray-800 ${!cell.isCurrentMonth ? 'opacity-30' : ''} ${isWeekend ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''}`}>
                    <div className={`text-[11px] font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : isWeekend ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {cell.date.getDate()}
                    </div>
                  </div>
                );
              })}
              {weekBookingBars[weekIdx]?.map((bar) => {
                const { booking, leftPercent, widthPercent, slot, lane } = bar;
                const sourceColor = getSourceColor(booking.source);
                const guestName = cleanGuestName(booking.guest_name);
                const propertyColor = booking.property_color || '#9CA3AF';
                const allNonCurrent = week.every((cell, idx) => {
                  const cellLeft = (idx / 7) * 100;
                  const cellRight = ((idx + 1) / 7) * 100;
                  if (cellLeft >= (leftPercent + widthPercent) || cellRight <= leftPercent) return true;
                  return !cell.isCurrentMonth;
                });
                return (
                  <div
                    key={`${booking.id}-w${weekIdx}`}
                    onClick={(e) => onBookingClick(booking, e)}
                    className={`absolute px-1 py-0.5 rounded cursor-pointer hover:brightness-110 transition-all overflow-hidden flex items-center gap-0.5 text-white text-[9px] font-medium shadow-sm ${allNonCurrent ? 'opacity-30' : ''}`}
                    style={{
                      backgroundColor: sourceColor,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      top: `${22 + (lane ?? slot) * 22}px`,
                      height: '20px',
                      zIndex: 10
                    }}
                    title={`${guestName} • ${booking.property_name}`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/50" style={{ backgroundColor: propertyColor }} />
                    <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{ color: sourceColor }}>
                      {getSourceInitial(booking.source).charAt(0)}
                    </div>
                    <span className="flex-1 min-w-0 truncate text-[10px]">{guestName}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
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
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  // Calendar mode: one property at a time via tabs
  const [activeCalendarPropertyId, setActiveCalendarPropertyId] = useState<number | null>(null);

  const displayPropertyId = useMemo(() => {
    if (selectedPropertyIds.length === 0) return '';
    if (selectedPropertyIds.length === 1) return selectedPropertyIds[0].toString();
    return '';
  }, [selectedPropertyIds]);

  const displaySource = useMemo(() => {
    if (selectedSources.length === 0) return '';
    if (selectedSources.length === 1) return selectedSources[0];
    return '';
  }, [selectedSources]);


  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // Initialize active calendar property when properties load
  useEffect(() => {
    if (properties.length > 0 && activeCalendarPropertyId === null) {
      setActiveCalendarPropertyId(properties[0].id);
    }
  }, [properties.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEmpty) {
      apiFetch('/bookings')
        .then(r => r.json())
        .then(d => setBookings(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [isEmpty]);

  // Deduplicate bookings
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
      const best = group.find(b => !isNoise(b.guest_name)) || group[0];
      result.push(best);
    }
    return result;
  }, [bookings]);

  // Filter bookings by selected properties and search
  const filteredBookings = useMemo(() => {
    let filtered = deduplicatedBookings;
    
    if (selectedPropertyIds.length > 0) {
      filtered = filtered.filter(b => selectedPropertyIds.includes(b.property_id));
    }
    
    if (selectedSources.length > 0) {
      filtered = filtered.filter(b => selectedSources.includes(normalizeSource(b.source)));
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        cleanGuestName(b.guest_name).toLowerCase().includes(query) ||
        b.property_name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [deduplicatedBookings, selectedPropertyIds, selectedSources, searchQuery]);

  // Calendar mode: bookings for the single active property tab (ignores property dropdown)
  const calendarBookings = useMemo(() => {
    if (activeCalendarPropertyId === null) return filteredBookings;
    let filtered = deduplicatedBookings.filter(b => b.property_id === activeCalendarPropertyId);
    if (selectedSources.length > 0) {
      filtered = filtered.filter(b => selectedSources.includes(normalizeSource(b.source)));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        cleanGuestName(b.guest_name).toLowerCase().includes(query) ||
        b.property_name.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [activeCalendarPropertyId, deduplicatedBookings, selectedSources, searchQuery, filteredBookings]);

  const calendarPropertySlotMap = useMemo(() => {
    const map = new Map<number, number>();
    const ids = [...new Set(calendarBookings.map(b => b.property_id))];
    ids.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [calendarBookings]);

  const calendarNumPropertySlots = calendarPropertySlotMap.size;

  // Today's activity
  const todayActivity = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    const checkinsToday = filteredBookings.filter(b => b.checkin_date === todayStr);
    const checkoutsToday = filteredBookings.filter(b => b.checkout_date === todayStr);
    const currentlyStaying = filteredBookings.filter(b => 
      b.checkin_date <= todayStr && b.checkout_date > todayStr
    );
    
    return { checkinsToday, checkoutsToday, currentlyStaying };
  }, [filteredBookings, today]);

  const upcomingCheckins = useMemo(() => {
    return filteredBookings
      .filter(b => new Date(b.checkin_date) > today)
      .sort((a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime())
      .slice(0, 5);
  }, [filteredBookings, today]);

  // Timeline view helpers
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

  const propertyData = useMemo(() => {
    return properties.map((p: any) => ({
      property: p,
      bookings: deduplicatedBookings.filter((b: Booking) => b.property_id === p.id)
        .sort((a: Booking, b: Booking) => a.checkin_date.localeCompare(b.checkin_date))
    }));
  }, [properties, deduplicatedBookings]);

  const calculateBarPosition = (booking: Booking, startDate: Date, dayWidth = 44) => {
    const msPerDay = 86400000;
    const startMs = startDate.getTime();
    const checkinMs = new Date(booking.checkin_date).getTime();
    const checkoutMs = new Date(booking.checkout_date).getTime();
    const leftDays = (checkinMs - startMs) / msPerDay;
    const durDays = (checkoutMs - checkinMs) / msPerDay;
    let leftPx = Math.max(0, leftDays * dayWidth);
    let widthPx = durDays * dayWidth;
    const totalDays = timelineDays.length;
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

  const handleBookingClick = (booking: Booking, _event: React.MouseEvent) => {
    setSelectedBooking(booking);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dayNames = lang === 'fr' 
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] 
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const shortDayNames = dayNames.map(d => d.slice(0, 2));

  const toggleProperty = useCallback((propertyId: number) => {
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  }, []);

  const toggleSource = useCallback((source: string) => {
    const norm = normalizeSource(source);
    setSelectedSources(prev => 
      prev.includes(norm) 
        ? prev.filter(s => s !== norm)
        : [...prev, norm]
    );
  }, []);

  // Calculate calendar grid for current month
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const totalCells = 42; // 6 weeks
    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];

    // Previous month trailing days
    const prevMo = month === 0 ? 11 : month - 1;
    const prevYr = month === 0 ? year - 1 : year;
    const prevMoDays = getDaysInMonth(prevYr, prevMo);

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(prevYr, prevMo, prevMoDays - i), isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }

    const nextMo = month === 11 ? 0 : month + 1;
    const nextYr = month === 11 ? year + 1 : year;
    const remaining = totalCells - days.length;

    for (let day = 1; day <= remaining; day++) {
      days.push({ date: new Date(nextYr, nextMo, day), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Group days into weeks for row-based rendering
  const weeks = useMemo(() => {
    const result: Array<typeof calendarDays> = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Build propertySlotMap: consistent vertical slot per property across the month
  const propertySlotMap = useMemo(() => {
    const map = new Map<number, number>();
    const propertyIds = [...new Set(filteredBookings.map(b => b.property_id))];
    propertyIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [filteredBookings]);

  const numPropertySlots = propertySlotMap.size;

  // Compute booking bars for each week (includes continuations and check-in/out overlap)
  const weekBookingBars = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0]?.date;
      const weekEnd = week[6]?.date;
      if (!weekStart || !weekEnd) return [];

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Find all bookings that overlap with this week
      const overlapping = filteredBookings.filter(b => {
        return b.checkin_date <= weekEndStr && b.checkout_date > weekStartStr;
      });

      return overlapping.map(booking => {
        const checkin = new Date(booking.checkin_date);
        const checkout = new Date(booking.checkout_date);

        // Determine start day index within the week
        let startDayIdx = 0;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && d.toISOString().split('T')[0] === booking.checkin_date) {
            startDayIdx = i;
            break;
          } else if (d && d < checkin) {
            startDayIdx = 0; // booking started before this week
          }
        }
        // If booking started before the week, pin to day 0
        if (checkin < weekStart) startDayIdx = 0;

        // Determine end day index within the week
        let endDayIdx = 6;
        for (let i = 6; i >= 0; i--) {
          const d = week[i]?.date;
          if (d && d.toISOString().split('T')[0] === booking.checkout_date) {
            endDayIdx = i;
            break;
          } else if (d && d >= checkout) {
            // checkout is exclusive, keep searching
          }
        }
        // If checkout is beyond the week, extend to end
        if (checkout > new Date(weekEnd.getTime() + 86400000)) endDayIdx = 7;

        // Checkout date is exclusive — the bar ends at the checkout day cell midpoint
        // Find exact end position
        let endPos = endDayIdx;
        const checkoutStr = booking.checkout_date;
        let isCheckoutDay = false;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && d.toISOString().split('T')[0] === checkoutStr) {
            endPos = i;
            isCheckoutDay = true;
            break;
          }
        }
        if (!isCheckoutDay && checkout > new Date(weekEnd.getTime() + 86400000)) {
          endPos = 7;
        }

        // Check if another booking starts on the same day this one ends (handoff)
        const hasHandoff = isCheckoutDay && filteredBookings.some(
          other => other.id !== booking.id && other.checkin_date === checkoutStr
        );

        // Check if this booking starts on a day where another ends (incoming handoff)
        const checkinStr = booking.checkin_date;
        let isCheckinInWeek = false;
        let checkinDayIdx = startDayIdx;
        for (let i = 0; i < 7; i++) {
          const d = week[i]?.date;
          if (d && d.toISOString().split('T')[0] === checkinStr) {
            isCheckinInWeek = true;
            checkinDayIdx = i;
            break;
          }
        }
        const hasIncomingHandoff = isCheckinInWeek && filteredBookings.some(
          other => other.id !== booking.id && other.checkout_date === checkinStr
        );

        // Calculate left% and width%
        let leftPercent = (startDayIdx / 7) * 100;
        let rightEdge: number;

        if (hasHandoff && isCheckoutDay) {
          // End at midpoint of checkout day
          rightEdge = ((endPos + 0.5) / 7) * 100;
        } else if (isCheckoutDay) {
          // End at the start of checkout day (checkout is exclusive)
          rightEdge = (endPos / 7) * 100;
        } else {
          rightEdge = (endPos / 7) * 100;
        }

        if (hasIncomingHandoff && isCheckinInWeek) {
          // Start at midpoint of checkin day
          leftPercent = ((checkinDayIdx + 0.5) / 7) * 100;
        }

        let widthPercent = rightEdge - leftPercent;
        if (widthPercent < 0) widthPercent = 0;

        const slot = propertySlotMap.get(booking.property_id) ?? 0;

        return {
          booking,
          leftPercent,
          widthPercent,
          slot,
          startDayIdx,
          isCheckoutDay,
          hasHandoff,
          hasIncomingHandoff,
        };
      }).filter(bar => bar.widthPercent > 0);
    });
  }, [weeks, filteredBookings, propertySlotMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">{lang === 'fr' ? 'Chargement...' : 'Loading...'}</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">{t('calendar', lang)}</h1>
        <EmptyState
          emoji="📅"
          title={lang === 'fr' ? "Aucune propriété" : "No properties yet"}
          subtitle={lang === 'fr' ? "Ajoutez une propriété et connectez vos calendriers pour voir les réservations ici." : "Add a property and connect your calendars to see bookings here."}
          ctaLabel={lang === 'fr' ? "+ Ajouter une propriété" : "+ Add Property"}
          ctaTo="/add-property"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* COMPACT HEADER */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          {/* Left: Navigation + Month */}
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            {(year !== today.getFullYear() || month !== today.getMonth()) && (
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                {lang === 'fr' ? "Aujourd'hui" : 'Today'}
              </button>
            )}
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
              {new Date(year, month).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </h1>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Right: Controls (scrollable on mobile) */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-0.5 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
            {/* Property Dropdown */}
            <div className="relative">
              <select 
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none w-48 cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:bg-gray-700"
                value={displayPropertyId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPropertyIds(val === '' ? [] : [Number(val)]);
                  // On mobile (no tabs), sync dropdown selection to active calendar property
                  if (val === '') {
                    setActiveCalendarPropertyId(properties[0]?.id ?? null);
                  } else {
                    setActiveCalendarPropertyId(Number(val));
                  }
                }}
              >
                <option value="">{lang === 'fr' ? 'Toutes propriétés' : 'All Properties'}</option>
                {properties.map((p: any) => (
                  <option key={p.id} value={p.id.toString()}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Platform Dropdown */}
            <div className="relative">
              <select 
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none w-40 cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:bg-gray-700"
                value={displaySource}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSources(val === '' ? [] : [val]);
                }}
              >
                <option value="">{lang === 'fr' ? 'Toutes plateformes' : 'All Platforms'}</option>
                <option value="airbnb">Airbnb</option>
                <option value="booking">Booking</option>
                <option value="smoobu">Smoobu</option>
                <option value="direct">Direct</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={lang === 'fr' ? "Rechercher" : "Search"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-40"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'calendar' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <CalendarIcon size={16} />
                {lang === 'fr' ? 'Calendrier' : 'Calendar'}
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'timeline' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <BarChart3 size={16} />
                {lang === 'fr' ? 'Timeline' : 'Timeline'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SOURCE LEGEND — desktop only */}
      <div className="hidden sm:block px-4 pt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 min-w-max pb-1">
        {[
          { source: 'airbnb', label: 'Airbnb' },
          { source: 'booking', label: 'Booking.com' },
          { source: 'smoobu', label: 'Smoobu' },
          { source: 'direct', label: 'Direct' },
        ].map(({ source, label }) => (
          <button
            key={source}
            type="button"
            onClick={() => toggleSource(source)}
            className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer ${
              selectedSources.includes(normalizeSource(source))
                ? 'bg-blue-100 dark:bg-blue-900/30 shadow-sm ring-1 ring-blue-400/50'
                : ''
            }`}
          >
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: getSourceColor(source) }}
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate">
              {label}
            </span>
          </button>
        ))}
        {properties.length > 0 && (
          <>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            {properties.slice(0, 5).map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProperty(p.id)}
                className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer ${
                  selectedPropertyIds.includes(p.id)
                    ? 'bg-blue-100 dark:bg-blue-900/30 shadow-sm ring-1 ring-blue-400/50'
                    : ''
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full border border-gray-200 dark:border-gray-600 flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.color || '#9CA3AF' }}
                />
                <span className="truncate max-w-[60px] text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {p.name}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
      </div>

      {/* PROPERTY TABS — Calendar mode only, desktop only (mobile uses dropdown) */}
      {viewMode === 'calendar' && properties.length > 0 && (
        <div className="hidden sm:block px-4 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 min-w-max pb-1">
            {properties.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveCalendarPropertyId(p.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                  activeCalendarPropertyId === p.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                style={{ minHeight: '36px' }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color || '#9CA3AF' }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="p-4">
        {viewMode === 'calendar' ? (
          /* 3-MONTH CALENDAR VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map(offset => {
              const m = month + offset;
              const y = year + Math.floor(m / 12);
              const mo = ((m % 12) + 12) % 12;
              return (
                <MonthGrid
                  key={`${y}-${mo}`}
                  year={y}
                  month={mo}
                  filteredBookings={calendarBookings}
                  propertySlotMap={calendarPropertySlotMap}
                  numPropertySlots={calendarNumPropertySlots}
                  today={today}
                  dayNames={dayNames}
                  lang={lang}
                  onBookingClick={handleBookingClick}
                />
              );
            })}
          </div>
        ) : (
          /* TIMELINE VIEW - Multi-property Gantt */
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div 
                  className="grid gap-px bg-gray-200 dark:bg-gray-700"
                  style={{
                    gridTemplateColumns: '160px repeat(42, 44px)'
                  }}
                >
                  {/* Property header (sticky) */}
                  <div 
                    className="sticky left-0 z-40 p-3 font-bold text-sm bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    style={{ gridRow: 1, gridColumn: 1 }}
                  >
                    {lang === 'fr' ? 'Propriétés' : 'Properties'}
                  </div>

                  {/* Date headers */}
                  {timelineDays.map((day, idx) => (
                    <div
                      key={`head-${idx}`}
                      className={`min-h-[48px] flex flex-col items-center justify-center p-1 text-xs font-medium border-b transition-colors ${
                        isSameDay(day, today) 
                          ? 'bg-blue-500 text-white font-bold' 
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                      }`}
                      style={{
                        gridRow: 1,
                        gridColumn: idx + 2
                      }}
                    >
                      <span className="text-base">{day.getDate()}</span>
                      <span className="text-[9px] opacity-75 uppercase">{shortDayNames[day.getDay()]}</span>
                    </div>
                  ))}

                  {/* Property rows */}
                  {propertyData.map(({property, bookings}, pIdx) => {
                    const rowNum = pIdx + 2;
                    return (
                      <>
                        {/* Property name (sticky) */}
                        <div
                          key={`prop-${property.id}`}
                          className="sticky left-0 z-20 bg-white dark:bg-gray-900 p-3 text-sm font-semibold border-r border-b border-gray-200 dark:border-gray-700 flex items-center gap-2"
                          style={{
                            gridRow: rowNum,
                            gridColumn: 1
                          }}
                        >
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: property.color || '#9CA3AF' }}
                          />
                          <span className="truncate">{property.name}</span>
                        </div>

                        {/* Timeline bar container */}
                        <div
                          key={`row-${property.id}`}
                          className="relative h-[44px] border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                          style={{
                            gridRow: rowNum,
                            gridColumn: '2 / 44'
                          }}
                        >
                          {/* Booking bars */}
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
                                className="absolute inset-y-1.5 px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-md border border-white/40 hover:shadow-xl hover:scale-[1.02] hover:z-10 transition-all cursor-pointer overflow-hidden"
                                style={{
                                  left: `${pos.left}px`,
                                  width: `${pos.width}px`,
                                  backgroundColor: sourceColor
                                }}
                                onClick={() => {
                                  setSelectedBooking(booking);
                                }}
                                title={`${guestName} • ${getSourceLabel(booking.source)} • ${booking.checkin_date} → ${booking.checkout_date}`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                  style={{ color: sourceColor }}
                                >
                                  {getSourceInitial(booking.source).charAt(0)}
                                </div>
                                <span className="truncate text-[11px] font-medium text-white">
                                  {isLeftClip && <span className="opacity-80 mr-1">← </span>}
                                  {guestName.slice(0, 24)}
                                  {isRightClip && <span className="opacity-80 ml-1"> →</span>}
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
          </div>
        )}

        {/* TODAY'S ACTIVITY + UPCOMING */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Activity */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {lang === 'fr' ? "Aujourd'hui" : 'Today'}
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <LogIn size={16} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lang === 'fr' ? "Arrivées aujourd'hui" : 'Check-ins today'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {todayActivity.checkinsToday.length} {lang === 'fr' ? 'réservations' : 'bookings'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <LogOut size={16} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lang === 'fr' ? "Départs aujourd'hui" : 'Check-outs today'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {todayActivity.checkoutsToday.length} {lang === 'fr' ? 'réservations' : 'bookings'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Home size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lang === 'fr' ? 'Séjours en cours' : 'Currently staying'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {todayActivity.currentlyStaying.length} {lang === 'fr' ? 'réservations' : 'bookings'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Check-ins */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {lang === 'fr' ? 'Prochaines arrivées' : 'Upcoming Check-ins'}
            </h2>
            
            <div className="space-y-2">
              {upcomingCheckins.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {lang === 'fr' ? 'Aucune arrivée prévue' : 'No upcoming check-ins'}
                </p>
              ) : (
                upcomingCheckins.map(booking => {
                  const checkin = new Date(booking.checkin_date);
                  const checkout = new Date(booking.checkout_date);
                  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div 
                      key={booking.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedBooking(booking);
                      }}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {checkin.getDate()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {checkin.toLocaleDateString(locale, { month: 'short' })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {cleanGuestName(booking.guest_name)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{booking.property_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: getSourceColor(booking.source) }}
                          />
                          <span>{getSourceLabel(booking.source)}</span>
                          <span className="ml-1">• {nights} {lang === 'fr' ? 'nuits' : 'nights'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Popover */}
      {selectedBooking && (
        <BookingPopover
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          lang={lang}
        />
      )}
    </div>
  );
}
