import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import { MapPin, Clock, CheckCircle2 } from 'lucide-react';

interface Task {
  id: number;
  property_name: string;
  date: string;
  status: string;
  rate: number;
}

export default function Schedule() {
  const { lang } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    apiFetch('/tasks').then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const updateStatus = async (id: number, status: string) => {
    const res = await apiFetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    done: 'bg-green-100 text-green-700',
  };

  const nextStatus: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'in_progress',
    in_progress: 'done',
  };

  const sorted = [...tasks].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('schedule', lang)}</h1>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-3 opacity-50" />
          <p>{lang === 'fr' ? 'Aucun nettoyage prévu' : 'No cleanings scheduled'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(task => (
            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{task.property_name}</p>
                  <p className="text-sm text-gray-500 mt-1">{task.date}</p>
                  <p className="text-sm text-gray-500">{task.rate} €</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[task.status] || ''}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              {nextStatus[task.status] && (
                <button
                  onClick={() => updateStatus(task.id, nextStatus[task.status])}
                  className="mt-3 w-full py-2 bg-blue-500 text-white text-sm rounded-lg font-medium hover:bg-blue-600">
                  {task.status === 'pending' ? (lang === 'fr' ? 'Confirmer' : 'Confirm') :
                   task.status === 'confirmed' ? (lang === 'fr' ? 'Commencer' : 'Start') :
                   (lang === 'fr' ? 'Terminer' : 'Mark Done')}
                </button>
              )}
              {task.status === 'done' && (
                <div className="mt-3 flex items-center justify-center gap-1 text-green-600 text-sm">
                  <CheckCircle2 size={16} /> {lang === 'fr' ? 'Terminé' : 'Completed'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
