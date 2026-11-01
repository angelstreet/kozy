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
    fetchCached('/tasks').then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [fetchCached]);

  if (loading) return <div className="p-4 text-center text-muted">Loading...</div>;

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = tasks.filter(t => t.status === 'pending' || t.status === 'confirmed');
  const todayTasks = tasks.filter(t => t.date === todayStr);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-accent text-accent-ink rounded-xl p-4">
        <p className="text-3xl font-semibold">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="text-sm opacity-80">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl p-3 text-center border border-line">
          <CalendarDays size={18} className="mx-auto text-accent mb-1" />
          <p className="text-xl font-semibold">{todayTasks.length}</p>
          <p className="text-xs text-muted">Today</p>
        </div>
        <div className="bg-surface rounded-xl p-3 text-center border border-line">
          <Clock size={18} className="mx-auto text-warn mb-1" />
          <p className="text-xl font-semibold">{upcoming.length}</p>
          <p className="text-xs text-muted">Upcoming</p>
        </div>
        <div className="bg-surface rounded-xl p-3 text-center border border-line">
          <CheckCircle size={18} className="mx-auto text-accent mb-1" />
          <p className="text-xl font-semibold">{tasks.filter(t => t.status === 'done').length}</p>
          <p className="text-xs text-muted">Done</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold">Upcoming Cleanings</h2>
      {upcoming.length === 0 ? (
        <EmptyState emoji="✨" title="All clear!" subtitle="No upcoming cleanings scheduled." />
      ) : (
        <div className="space-y-2">
          {upcoming.map(t => (
            <div key={t.id} className="bg-surface rounded-xl p-4 border border-line">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Property #{t.property_id}</p>
                  <p className="text-sm text-muted">{t.date}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'pending' ? 'bg-warn-tint text-warn' : 'bg-tint text-accent'}`}>
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
