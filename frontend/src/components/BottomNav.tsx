import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { Home, CalendarDays, Building2, Menu, ShoppingCart, TrendingUp, Bell } from 'lucide-react';
import { apiFetch } from '@/api';
import { useEffect, useState } from 'react';

const ownerTabs = [
  { to: '/dashboard', icon: Home, label: 'dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'calendar' },
  { to: '/properties', icon: Building2, label: 'properties' },
  { to: '/analytics', icon: TrendingUp, label: 'analytics' },
  { to: '/more', icon: Menu, label: 'more' },
];

const cleanerTabs = [
  { to: '/c/schedule', icon: CalendarDays, label: 'schedule' },
  { to: '/c/shopping', icon: ShoppingCart, label: 'shopping' },
  { to: '/c/notifications', icon: Bell, label: 'notifications' },
  { to: '/c/more', icon: Menu, label: 'more' },
];

export default function BottomNav() {
  const { role } = useAuth();
  const { lang } = useApp();
  const tabs = role === 'owner' ? ownerTabs : cleanerTabs;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (role !== 'cleaner') return;
    const cleanerId = localStorage.getItem('kozy_cleaner_id') || '15';
    apiFetch(`/notifications?cleaner_id=${cleanerId}`)
      .then(r => r.json())
      .then((d: any[]) => {
        if (Array.isArray(d)) setUnreadCount(d.filter(n => n.read === 0).length);
      })
      .catch(() => {});
    const interval = setInterval(() => {
      apiFetch(`/notifications?cleaner_id=${cleanerId}`)
        .then(r => r.json())
        .then((d: any[]) => {
          if (Array.isArray(d)) setUnreadCount(d.filter(n => n.read === 0).length);
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [role]);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex justify-around py-2 z-50">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) =>
          `flex flex-col items-center text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}`
        }>
          <div className="relative">
            <Icon size={20} />
            {label === 'notifications' && unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="mt-0.5">{t(label, lang)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
