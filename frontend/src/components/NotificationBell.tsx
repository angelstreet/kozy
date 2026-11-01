import { useEffect, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/api';

export default function NotificationBell() {
  const { cleanerId } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!cleanerId) return;
    try {
      const res = await apiFetch('/notifications?cleaner_id=' + cleanerId);
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
      className="icon-btn relative"
      aria-label="Notifications"
    >
      <Bell size={20} strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-danger text-accent-ink text-[10px] font-semibold rounded-full flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
