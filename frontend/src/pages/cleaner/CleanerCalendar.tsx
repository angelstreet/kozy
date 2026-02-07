import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';

export default function CleanerCalendar() {
  const { lang, fetchCached } = useApp();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCached('/api/tasks').then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, [fetchCached]);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  // Group tasks by date
  const byDate: Record<string, any[]> = {};
  tasks.forEach(t => { (byDate[t.date] ||= []).push(t); });
  const dates = Object.keys(byDate).sort();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('calendar', lang)}</h1>
      {dates.length === 0 ? (
        <EmptyState emoji="📅" title="No cleanings" subtitle="Your scheduled cleanings will appear here." />
      ) : (
        <div className="space-y-4">
          {dates.map(date => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">{new Date(date + 'T00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
              <div className="space-y-2">
                {byDate[date].map(t => (
                  <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm flex justify-between items-center">
                    <span className="font-medium">Property #{t.property_id}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
