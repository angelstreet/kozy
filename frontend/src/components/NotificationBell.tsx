import { useEffect, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationBell() {
  const { cleanerId } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!cleanerId) return;
    try {
      const res = await fetch('/api/notifications?cleaner_id=' + cleanerId);
      const data = await res.json();
      if (Array.isArray(data)) {
        setUnread(data.filter((n: any) => !n.read).length);
      }
    } catch {}
  }, [cleanerId]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnread]);

  if (!cleanerId) return null;

  return (
    <button
      onClick={() => navigate('/c/notifications')}
      className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Notifications"
    >
      <Bell size={20} className="text-gray-600 dark:text-gray-300" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
