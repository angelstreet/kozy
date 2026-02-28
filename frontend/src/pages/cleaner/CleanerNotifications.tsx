import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

interface Notification {
  id: number;
  cleaner_id: number;
  type: string;
  title: string;
  body: string;
  read: number;
  created_at: string;
}

function getCleanerId(): string {
  return localStorage.getItem('kozy_cleaner_id') || '15';
}

export default function CleanerNotifications() {
  const { lang } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const cleanerId = getCleanerId();

  useEffect(() => {
    apiFetch(`/notifications?cleaner_id=${cleanerId}`)
      .then(r => r.json())
      .then(d => {
        setNotifications(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cleanerId]);

  const markRead = async (id: number) => {
    const res = await apiFetch(`/notifications/${id}`, { method: 'PATCH' });
    if (res.ok) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
        <Bell size={22} />
        {t('notifications', lang)}
      </h1>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t('no_notifications', lang)}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map(n => (
            <li
              key={n.id}
              className={`rounded-xl p-4 shadow-sm border transition-all cursor-pointer ${
                n.read === 0
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                  : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
              }`}
              onClick={() => n.read === 0 && markRead(n.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.read === 0 && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <p className={`font-semibold text-sm truncate ${
                      n.read === 0 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {n.title}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                    {n.body}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {new Date(n.created_at + 'Z').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {n.read === 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); markRead(n.id); }}
                    className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                    title={t('mark_read', lang)}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
