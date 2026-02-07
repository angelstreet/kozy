import { useApp } from '@/contexts/AppContext';
import { useEffect, useState } from 'react';
import { CalendarDays, Clock, CheckCircle } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

export default function CleanerDashboard() {
  const { lang, fetchCached } = useApp();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);

  useEffect(() => {
    fetchCached('/api/tasks').then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [fetchCached]);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = tasks.filter(t => t.status === 'pending' || t.status === 'confirmed');
  const todayTasks = tasks.filter(t => t.date === todayStr);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-4">
        <p className="text-3xl font-bold">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="text-sm opacity-80">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <CalendarDays size={18} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xl font-bold">{todayTasks.length}</p>
          <p className="text-xs text-gray-400">Today</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <Clock size={18} className="mx-auto text-orange-500 mb-1" />
          <p className="text-xl font-bold">{upcoming.length}</p>
          <p className="text-xs text-gray-400">Upcoming</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
          <CheckCircle size={18} className="mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold">{tasks.filter(t => t.status === 'done').length}</p>
          <p className="text-xs text-gray-400">Done</p>
        </div>
      </div>

      <h2 className="text-lg font-bold">Upcoming Cleanings</h2>
      {upcoming.length === 0 ? (
        <EmptyState emoji="✨" title="All clear!" subtitle="No upcoming cleanings scheduled." />
      ) : (
        <div className="space-y-2">
          {upcoming.map(t => (
            <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Property #{t.property_id}</p>
                  <p className="text-sm text-gray-500">{t.date}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
