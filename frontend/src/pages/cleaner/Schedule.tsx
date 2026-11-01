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
    pending: 'bg-warn-tint text-warn',
    confirmed: 'bg-tint text-accent',
    in_progress: 'bg-info-tint text-info',
    done: 'bg-tint text-accent',
  };

  const nextStatus: Record<string, string> = {
    pending: 'confirmed',
    confirmed: 'in_progress',
    in_progress: 'done',
  };

  const sorted = [...tasks].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-4">
      <h1 className="page-title mb-4">{t('schedule', lang)}</h1>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <Clock size={48} className="mx-auto mb-3 opacity-50" />
          <p>{lang === 'fr' ? 'Aucun nettoyage prévu' : 'No cleanings scheduled'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(task => (
            <div key={task.id} className="bg-surface rounded-xl p-4 border border-line">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{task.property_name}</p>
                  <p className="text-sm text-muted mt-1">{task.date}</p>
                  <p className="text-sm text-muted">{task.rate} €</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[task.status] || ''}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              {nextStatus[task.status] && (
                <button
                  onClick={() => updateStatus(task.id, nextStatus[task.status])}
                  className="mt-3 w-full py-2 bg-accent text-accent-ink text-sm rounded-lg font-medium hover:bg-accent-hover">
                  {task.status === 'pending' ? (lang === 'fr' ? 'Confirmer' : 'Confirm') :
                   task.status === 'confirmed' ? (lang === 'fr' ? 'Commencer' : 'Start') :
                   (lang === 'fr' ? 'Terminer' : 'Mark Done')}
                </button>
              )}
              {task.status === 'done' && (
                <div className="mt-3 flex items-center justify-center gap-1 text-accent text-sm">
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
