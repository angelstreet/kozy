import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useEffect, useState, useMemo, useRef } from 'react';
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
}

// Source-based colors (EXACT spec colors)
function getSourceColor(source: string): string {
  if (source === 'airbnb') return '#EF4444'; // red
  if (source === 'booking' || source === 'booking.com') return '#3B82F6'; // blue
  if (source === 'smoobu' || source === 'direct') return '#10B981'; // green
  return '#6B7280'; // gray fallback
}

function getSourceInitial(source: string): string {
  if (source === 'airbnb') return 'A.';
  if (source === 'booking' || source === 'booking.com') return 'B.';
  if (source === 'smoobu' || source === 'direct') return 'D.';
  return 'D.';
}

function getSourceLabel(source: string): string {
  if (source === 'airbnb') return 'Airbnb';
  if (source === 'booking' || source === 'booking.com') return 'Booking.com';
  if (source === 'smoobu' || source === 'direct') return 'Direct';
  return source;
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

// Booking Popover Component with smart positioning
function BookingPopover({ 
  booking, 
  position,
  onClose, 
  lang 
}: { 
  booking: Booking; 
  position: { top: number; left: number; }
  onClose: () => void; 
  lang: string 
}) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const checkin = new Date(booking.checkin_date);
  const checkout = new Date(booking.checkout_date);
  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Smart positioning to avoid viewport cropping
  useEffect(() => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let { top, left } = position;
      
      // Check right boundary
      if (left + rect.width > viewportWidth - 20) {
        left = viewportWidth - rect.width - 20;
      }
      
      // Check left boundary
      if (left < 20) {
        left = 20;
      }
      
      // Check bottom boundary (fixed positioning = relative to viewport)
      if (top + rect.height > viewportHeight - 20) {
        top = viewportHeight - rect.height - 20;
      }
      
      // Check top boundary
      if (top < 20) {
        top = 20;
      }
      
      setAdjustedPosition({ top, left });
    }
  }, [position]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={popoverRef}
      className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 w-80 z-50"
      style={{ 
        top: `${adjustedPosition.top}px`, 
        left: `${adjustedPosition.left}px`,
      }}
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
  );
}

export default function Calendar() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');
  const [searchQuery, setSearchQuery] = useState('');

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

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
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        cleanGuestName(b.guest_name).toLowerCase().includes(query) ||
        b.property_name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [deduplicatedBookings, selectedPropertyIds, searchQuery]);

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

  const shortDayNames = dayNames.map(d => d.slice(0, 2));

  const handleBookingClick = (booking: Booking, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setPopoverPosition({ 
      top: rect.top + rect.height + 5, 
      left: rect.left 
    });
    setSelectedBooking(booking);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dayNames = lang === 'fr' 
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] 
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handlePropertySelection = (propertyId: number) => {
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

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

  // Calculate calendar grid for current month
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const totalCells = 42; // 6 weeks
  const calendarDays: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];
  
  // Previous month trailing days
  const prevMonthNum = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDays = getDaysInMonth(prevYear, prevMonthNum);
  
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ 
      date: new Date(prevYear, prevMonthNum, prevMonthDays - i), 
      isCurrentMonth: false 
    });
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ 
      date: new Date(year, month, day), 
      isCurrentMonth: true 
    });
  }
  
  // Next month leading days
  const nextMonthNum = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const remainingCells = totalCells - calendarDays.length;
  
  for (let day = 1; day <= remainingCells; day++) {
    calendarDays.push({ 
      date: new Date(nextYear, nextMonthNum, day), 
      isCurrentMonth: false 
    });
  }

  // Group days into weeks for row-based rendering
  const weeks: Array<typeof calendarDays> = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* COMPACT HEADER */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Navigation + Month */}
          <div className="flex items-center gap-3">
            <button 
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white min-w-[140px]">
              {new Date(year, month).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </h1>
            <button 
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            {/* Property Multi-Select Dropdown */}
            <div className="relative">
              <select
                multiple={false}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors appearance-none pr-8"
                value={selectedPropertyIds.length === 0 ? 'all' : selectedPropertyIds[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setSelectedPropertyIds([]);
                  } else {
                    setSelectedPropertyIds([Number(val)]);
                  }
                }}
              >
                <option value="all">
                  {lang === 'fr' ? 'Toutes les propriétés' : 'All properties'}
                </option>
                {properties.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">▾</div>
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

      {/* MAIN CONTENT */}
      <div className="p-4">
        {viewMode === 'calendar' ? (
          /* CALENDAR VIEW */
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              {dayNames.map((day, idx) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-semibold py-2 ${
                    idx >= 5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid - WEEK ROWS with spanning bars */}
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 relative" style={{ minHeight: '100px' }}>
                  {week.map((cell, dayIdx) => {
                    if (!cell.date) return <div key={dayIdx} className="border-r border-gray-100 dark:border-gray-800" />;
                    
                    const dateStr = cell.date.toISOString().split('T')[0];
                    const isToday = cell.date.toDateString() === today.toDateString();
                    const dayOfWeek = cell.date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    return (
                      <div 
                        key={dayIdx}
                        className={`relative p-2 border-r border-gray-100 dark:border-gray-800 ${
                          !cell.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-950 opacity-40' : ''
                        } ${isWeekend ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''}`}
                      >
                        <div className={`text-sm font-semibold ${
                          isToday 
                            ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' 
                            : isWeekend
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {cell.date.getDate()}
                        </div>
                      </div>
                    );
                  })}

                  {/* BOOKING BARS - Absolute positioned to span across week */}
                  {week.map((cell, dayIdx) => {
                    if (!cell.date || !cell.isCurrentMonth) return null;
                    
                    const dateStr = cell.date.toISOString().split('T')[0];
                    
                    // Find bookings that START on this specific day
                    const startingBookings = filteredBookings.filter(b => b.checkin_date === dateStr);
                    
                    return startingBookings.map((booking, bookingIdx) => {
                      const checkin = new Date(booking.checkin_date);
                      const checkout = new Date(booking.checkout_date);
                      const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
                      
                      // Calculate span within this week
                      let span = 1;
                      for (let i = 1; i < nights && dayIdx + i < 7; i++) {
                        const nextDay = week[dayIdx + i];
                        if (nextDay && nextDay.isCurrentMonth) {
                          span++;
                        } else {
                          break;
                        }
                      }
                      
                      const sourceColor = getSourceColor(booking.source);
                      const guestName = cleanGuestName(booking.guest_name);
                      
                      // Position: left = (dayIdx / 7) * 100%, width = (span / 7) * 100%
                      const leftPercent = (dayIdx / 7) * 100;
                      const widthPercent = (span / 7) * 100;
                      
                      return (
                        <div
                          key={`${booking.id}-${dayIdx}`}
                          onClick={(e) => handleBookingClick(booking, e)}
                          className="absolute px-2 py-1 rounded cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 text-white text-xs font-medium shadow-sm"
                          style={{
                            backgroundColor: sourceColor,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            top: `${32 + bookingIdx * 24}px`, // Stack multiple bookings vertically
                            zIndex: 10
                          }}
                          title={`${guestName} • ${booking.property_name}`}
                        >
                          <div 
                            className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ color: sourceColor }}
                          >
                            {getSourceInitial(booking.source).charAt(0)}
                          </div>
                          <span className="truncate">{guestName}</span>
                        </div>
                      );
                    });
                  })}
                </div>
              ))}
            </div>
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
                          className="relative h-[56px] border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
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
                                  backgroundColor: sourceColor,
                                  transform: `translateY(${bIdx * 4}px)`
                                }}
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setPopoverPosition({ 
                                    top: rect.top + window.scrollY + rect.height + 5, 
                                    left: rect.left + window.scrollX 
                                  });
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
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPopoverPosition({ 
                          top: rect.top, 
                          left: rect.right + 10 
                        });
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
          position={popoverPosition}
          onClose={() => setSelectedBooking(null)}
          lang={lang}
        />
      )}
    </div>
  );
}
