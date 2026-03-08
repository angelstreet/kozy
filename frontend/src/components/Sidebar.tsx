import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { Home, CalendarDays, Building2, Menu, ShoppingCart, TrendingUp, Bell } from 'lucide-react';
import { apiFetch } from '@/api';
import { useEffect, useState } from 'react';

const ownerNav = [
  { to: '/dashboard', icon: Home, label: 'dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'calendar' },
  { to: '/properties', icon: Building2, label: 'properties' },
  { to: '/analytics', icon: TrendingUp, label: 'analytics' },
  { to: '/more', icon: Menu, label: 'more' },
];

const cleanerNav = [
  { to: '/c/schedule', icon: CalendarDays, label: 'schedule' },
  { to: '/c/shopping', icon: ShoppingCart, label: 'shopping' },
  { to: '/c/notifications', icon: Bell, label: 'notifications' },
  { to: '/c/more', icon: Menu, label: 'more' },
];

export default function Sidebar() {
  const { role } = useAuth();
  const { lang } = useApp();
  const navItems = role === 'owner' ? ownerNav : cleanerNav;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (role !== 'cleaner') return;
    const cleanerId = localStorage.getItem('kozy_cleaner_id') || '15';
    const load = () => {
      apiFetch(`/notifications?cleaner_id=${cleanerId}`)
        .then(r => r.json())
        .then((d: any[]) => { if (Array.isArray(d)) setUnreadCount(d.filter(n => n.read === 0).length); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [role]);

  return (
    <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 z-40 hidden lg:block">
      <div className="p-4 border-b dark:border-gray-700">
        <img src="/kozy/logo.png" alt="Kozy" className="h-8" />
      </div>
      <nav className="flex-1 p-2 lg:p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 p-3 rounded-r-lg transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white shadow-md lg:shadow-lg'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600'
              }`
            }
          >
            <div className="relative">
              <Icon size={20} />
              {label === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="hidden lg:block text-sm font-medium">{t(label, lang)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}