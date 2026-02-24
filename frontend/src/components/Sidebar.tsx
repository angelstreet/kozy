import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { Home, CalendarDays, Building2, Menu, ShoppingCart, TrendingUp } from 'lucide-react';

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
  { to: '/c/more', icon: Menu, label: 'more' },
];

export default function Sidebar() {
  const { role } = useAuth();
  const { lang } = useApp();
  const navItems = role === 'owner' ? ownerNav : cleanerNav;

  return (
    <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 z-40 hidden lg:block">
      <div className="p-4 border-b dark:border-gray-700">
        <span className="font-bold text-xl block lg:hidden">Kozy</span>
        <span className="font-bold text-2xl hidden lg:block">🏠 Kozy</span>
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
            <Icon size={20} />
            <span className="hidden lg:block text-sm font-medium">{t(label, lang)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}