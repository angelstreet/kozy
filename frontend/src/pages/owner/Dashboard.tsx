import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
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
      fetch('/api/tasks').then(r => r.json()).then(setTasks).catch(() => {});
      fetch('/api/bookings').then(r => r.json()).then(setBookings).catch(() => {});
    }
  }, [isEmpty]);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-6 mb-6">
          <p className="text-3xl font-bold">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm opacity-80">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
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

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-4">
        <p className="text-3xl font-bold">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="text-sm opacity-80">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-500 mb-1"><Building2 size={18} /><span className="text-sm font-medium">Properties</span></div>
          <p className="text-2xl font-bold">{properties.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-green-500 mb-1"><CalendarDays size={18} /><span className="text-sm font-medium">Bookings</span></div>
          <p className="text-2xl font-bold">{bookings.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-orange-500 mb-1"><Clock size={18} /><span className="text-sm font-medium">Pending</span></div>
          <p className="text-2xl font-bold">{pendingTasks.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-purple-500 mb-1"><Users size={18} /><span className="text-sm font-medium">Today</span></div>
          <p className="text-2xl font-bold">{todayTasks.length}</p>
        </div>
      </div>

      {/* Property list */}
      <h2 className="text-lg font-bold mt-2">Your Properties</h2>
      <div className="space-y-2">
        {properties.map(p => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-sm text-gray-500 truncate">{p.address}</p>
            </div>
            <div className="text-sm text-gray-400">€{p.rate}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
