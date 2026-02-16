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
  Filter,
  Settings,
  Plus,
  Search
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

// Source-based colors
function getSourceColor(source: string): string {
  if (source === 'airbnb') return '#FF5A5F'; // Airbnb pink/red
  if (source === 'booking' || source === 'booking.com') return '#003580'; // Booking.com blue
  if (source === 'smoobu' || source === 'direct') return '#10B981'; // Direct green
  return '#6B7280'; // gray fallback
}

function getSourceInitial(source: string): string {
  if (source === 'airbnb') return 'A';
  if (source === 'booking' || source === 'booking.com') return 'B';
  if (source === 'smoobu' || source === 'direct') return 'D';
  return 'D';
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

// Booking Popover Component
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
      className="fixed bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 w-80 z-50"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {cleanGuestName(booking.guest_name)}
        </h3>
        <button 
          onClick={onClose} 
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: getSourceColor(booking.source) }}
          >
            {getSourceInitial(booking.source)}
          </div>
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
            {getSourceLabel(booking.source)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Users size={16} />
          <span>5 {lang === 'fr' ? 'voyageurs' : 'guests'}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Moon size={16} />
          <span>{nights} {lang === 'fr' ? (nights > 1 ? 'nuits' : 'nuit') : (nights > 1 ? 'nights' : 'night')}</span>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
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

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp size={16} className="text-gray-500" />
            <span className="text-gray-500">{lang === 'fr' ? 'Valeur du paiement' : 'Payout value'}</span>
            <span className="ml-auto font-bold text-gray-900 dark:text-white">730.41</span>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <button className="w-full px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
            {lang === 'fr' ? 'Voir plus' : 'View more'}
          </button>
          <button className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {lang === 'fr' ? 'Modifier la réservation' : 'Edit booking'}
          </button>
          <button className="w-full px-4 py-2.5 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            {lang === 'fr' ? 'Annuler la réservation' : 'Cancel booking'}
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
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');
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

  // Filter bookings by selected property
  const filteredBookings = useMemo(() => {
    let filtered = deduplicatedBookings;
    if (selectedPropertyId) {
      filtered = filtered.filter(b => b.property_id === selectedPropertyId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        cleanGuestName(b.guest_name).toLowerCase().includes(query) ||
        b.property_name.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [deduplicatedBookings, selectedPropertyId, searchQuery]);

  // Generate 3 months for yearly view
  const months = useMemo(() => {
    return [0, 1, 2].map(offset => {
      const m = month + offset;
      const y = year + Math.floor(m / 12);
      const actualMonth = m % 12;
      return { year: y, month: actualMonth };
    });
  }, [year, month]);

  const handleBookingClick = (booking: Booking, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Position popover to the right and below the booking, with boundary checks
    let top = rect.top + window.scrollY;
    let left = rect.right + window.scrollX + 10;
    
    // If popover would go off right edge, position it to the left instead
    if (left + 320 > viewportWidth) {
      left = rect.left + window.scrollX - 330;
    }
    
    // If popover would go off bottom, position it higher
    if (top + 500 > viewportHeight + window.scrollY) {
      top = Math.max(10, viewportHeight + window.scrollY - 510);
    }
    
    setPopoverPosition({ top, left });
    setSelectedBooking(booking);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dayNames = lang === 'fr' 
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] 
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Plus size={18} />
            {lang === 'fr' ? 'Entrer une réservation' : 'Enter booking'}
          </button>
          <div className="flex-1 max-w-md relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={lang === 'fr' ? "Voyageur ou ID de réservation" : "Guest or Reservation ID"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Calendrier' : 'Calendar'}
          </h1>

          <div className="flex items-center gap-3">
            {/* Property Dropdown */}
            <select
              value={selectedPropertyId || ''}
              onChange={(e) => setSelectedPropertyId(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer font-medium"
            >
              <option value="">
                {properties.length > 1 
                  ? (lang === 'fr' ? 'Toutes les propriétés' : 'All properties')
                  : properties[0]?.name || (lang === 'fr' ? 'Propriété' : 'Property')
                }
              </option>
              {properties.length > 1 && properties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Month Picker */}
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
              <CalendarIcon size={18} className="text-gray-600 dark:text-gray-400" />
              <span className="font-medium">
                {new Date(year, month).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 font-medium">
              <Filter size={18} />
              {lang === 'fr' ? 'Filtres' : 'Filters'}
            </button>

            <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 font-medium">
              <Settings size={18} />
              {lang === 'fr' ? 'Personnaliser' : 'Customize'}
            </button>

            <div className="flex items-center gap-1 px-1 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
              <CalendarIcon size={18} className="ml-2 text-gray-500" />
              <span className="mx-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                {lang === 'fr' ? 'Annuel' : 'Yearly'}
              </span>
            </div>

            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setViewMode('multi')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'multi' 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {lang === 'fr' ? 'Multi' : 'Multi'}
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'single' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {lang === 'fr' ? 'Unique' : 'Single'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Content */}
      <div className="px-6 py-8">
        <div className="flex items-center justify-center gap-8 mb-8">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* 3-Month Yearly View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1600px] mx-auto">
          {months.map(({ year: y, month: m }) => {
            const daysInMonth = getDaysInMonth(y, m);
            const firstDay = getFirstDayOfWeek(y, m);
            const monthName = new Date(y, m).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
            
            // Calculate calendar grid (6 weeks = 42 cells)
            const totalCells = 42;
            const cells: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];
            
            // Previous month trailing days
            const prevMonth = m === 0 ? 11 : m - 1;
            const prevYear = m === 0 ? y - 1 : y;
            const prevMonthDays = getDaysInMonth(prevYear, prevMonth);
            
            for (let i = firstDay - 1; i >= 0; i--) {
              cells.push({ 
                date: new Date(prevYear, prevMonth, prevMonthDays - i), 
                isCurrentMonth: false 
              });
            }
            
            // Current month days
            for (let day = 1; day <= daysInMonth; day++) {
              cells.push({ 
                date: new Date(y, m, day), 
                isCurrentMonth: true 
              });
            }
            
            // Next month leading days
            const nextMonth = m === 11 ? 0 : m + 1;
            const nextYear = m === 11 ? y + 1 : y;
            const remainingCells = totalCells - cells.length;
            
            for (let day = 1; day <= remainingCells; day++) {
              cells.push({ 
                date: new Date(nextYear, nextMonth, day), 
                isCurrentMonth: false 
              });
            }

            return (
              <div key={`${y}-${m}`} className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white capitalize">
                  {monthName}
                </h2>
                
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
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

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1 relative">
                  {cells.map((cell, idx) => {
                    if (!cell.date) return <div key={idx} />;
                    
                    const dateStr = cell.date.toISOString().split('T')[0];
                    const isToday = cell.date.toDateString() === today.toDateString();
                    const dayOfWeek = cell.date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    // Find bookings that start on this day
                    const startingBookings = filteredBookings.filter(b => 
                      b.checkin_date === dateStr
                    );

                    return (
                      <div 
                        key={idx}
                        className={`relative min-h-[60px] p-1 border border-gray-100 dark:border-gray-800 ${
                          !cell.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-950 opacity-50' : ''
                        } ${isWeekend ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                      >
                        <div className={`text-sm font-semibold ${
                          isToday 
                            ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' 
                            : isWeekend
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {cell.date.getDate()}
                        </div>

                        {/* Render booking bars that start on this day */}
                        <div className="absolute left-1 right-0 top-7 space-y-0.5">
                          {startingBookings.map((booking) => {
                            const checkin = new Date(booking.checkin_date);
                            const checkout = new Date(booking.checkout_date);
                            const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
                            
                            // Calculate how many cells this booking spans
                            const currentCellDate = cell.date!;
                            let span = 1;
                            for (let i = 1; i < nights; i++) {
                              const nextDate = new Date(currentCellDate);
                              nextDate.setDate(nextDate.getDate() + i);
                              
                              // Check if next date is still in this month's view
                              if (nextDate.getMonth() === m && nextDate.getFullYear() === y) {
                                span++;
                              } else {
                                break;
                              }
                              
                              // Stop at end of week
                              if ((idx + i) % 7 === 0) break;
                            }
                            
                            const sourceColor = getSourceColor(booking.source);
                            const guestName = cleanGuestName(booking.guest_name);

                            return (
                              <div
                                key={booking.id}
                                onClick={(e) => handleBookingClick(booking, e)}
                                className="absolute left-0 px-2 py-1 rounded-lg cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 text-white text-xs font-medium shadow-sm"
                                style={{
                                  backgroundColor: sourceColor,
                                  width: `calc(${span * 100}% + ${(span - 1) * 4}px)`,
                                  zIndex: 10
                                }}
                                title={`${guestName} • ${booking.property_name} • ${nights} ${nights > 1 ? 'nights' : 'night'}`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                  style={{ color: sourceColor }}
                                >
                                  {getSourceInitial(booking.source)}
                                </div>
                                <span className="truncate">{guestName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming Check-ins Section */}
        <div className="mt-12 max-w-[1600px] mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {lang === 'fr' ? 'Événements à venir' : 'Upcoming events'}
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                {lang === 'fr' ? 'Voir tous les événements' : 'View all events'} →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredBookings
                .filter(b => new Date(b.checkin_date) >= today)
                .sort((a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime())
                .slice(0, 4)
                .map(booking => {
                  const checkin = new Date(booking.checkin_date);
                  const checkout = new Date(booking.checkout_date);
                  const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div 
                      key={booking.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPopoverPosition({ 
                          top: rect.top + window.scrollY, 
                          left: rect.right + window.scrollX + 10 
                        });
                        setSelectedBooking(booking);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                          {checkin.getDate()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-1">
                            {checkin.toLocaleDateString(locale, { weekday: 'short', month: 'short' })}
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {cleanGuestName(booking.guest_name)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <Users size={12} />
                            <span>2</span>
                            <Moon size={12} className="ml-2" />
                            <span>{nights}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {filteredBookings.filter(b => new Date(b.checkin_date) >= today).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CalendarIcon size={48} className="mx-auto mb-3 opacity-30" />
                <p>{lang === 'fr' ? 'Aucune réservation à venir' : 'No upcoming bookings'}</p>
              </div>
            )}
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
