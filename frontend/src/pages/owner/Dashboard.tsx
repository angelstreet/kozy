import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import BookingActivityPanels from '@/components/owner/BookingActivityPanels';
import { Building2, CalendarDays, Users, Clock } from 'lucide-react';

export default function Dashboard() {
  const { lang } = useApp();
  const { properties, loading, isEmpty } = useProperties();
  const [time, setTime] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  
  useEffect(() => {
    if (!isEmpty) {
      apiFetch('/tasks').then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => {});
      apiFetch('/bookings').then(r => r.json()).then(d => setBookings(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isEmpty]);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl px-4 py-2.5 mb-6 flex items-center justify-between">
          <span className="text-sm font-medium capitalize">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span className="text-sm font-bold tabular-nums">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <EmptyState
          emoji="🏠"
          title="Welcome to Kozy!"
          subtitle="Manage your rental properties and cleaners in one place. Start by adding your first property."
          ctaLabel="+ Add your first property"
          ctaTo="/add-property"
        />
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(t => t.date === todayStr);

  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const timeStr = time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="p-4 space-y-3">
      {/* Compact date/time banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{dateStr}</span>
        <span className="text-sm font-bold tabular-nums">{timeStr}</span>
      </div>

      {/* Stats — compact 4-grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <Building2 size={16} className="text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{properties.length}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Properties</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <CalendarDays size={16} className="text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{bookings.length}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Bookings</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <Clock size={16} className="text-orange-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{pendingTasks.length}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Pending</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <Users size={16} className="text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{todayTasks.length}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Today</p>
        </div>
      </div>

      <BookingActivityPanels bookings={bookings} lang={lang} />

      {/* Property list */}
      <h2 className="text-base font-bold">Your Properties</h2>
      <div className="space-y-2">
        {Array.isArray(properties) ? properties.map(p => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 shadow-sm flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-xs text-gray-500 truncate">{p.address}</p>
            </div>
            <div className="text-xs text-gray-400">€{p.rate}/n</div>
          </div>
        )) : null}
      </div>
    </div>
  );
}
