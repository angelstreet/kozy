import { useEffect, useState } from 'react';
import { apiFetch } from '@/api';

/** Unread notifications for the cleaner view (polled every minute). */
export function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const cleanerId = localStorage.getItem('kozy_cleaner_id') || '15';
    const load = () => apiFetch(`/notifications?cleaner_id=${cleanerId}`)
      .then(r => r.json())
      .then((d: any[]) => { if (Array.isArray(d)) setCount(d.filter(n => n.read === 0).length); })
      .catch(() => {});
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [enabled]);
  return count;
}
