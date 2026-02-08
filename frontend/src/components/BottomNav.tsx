import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { Home, CalendarDays, Building2, Menu, ShoppingCart } from 'lucide-react';

const ownerTabs = [
  { to: '/dashboard', icon: Home, label: 'dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'calendar' },
  { to: '/properties', icon: Building2, label: 'properties' },
  { to: '/more', icon: Menu, label: 'more' },
];

const cleanerTabs = [
  { to: '/c/schedule', icon: CalendarDays, label: 'schedule' },
  { to: '/c/shopping', icon: ShoppingCart, label: 'shopping' },
  { to: '/c/more', icon: Menu, label: 'more' },
];

export default function BottomNav() {
  const { role } = useAuth();
  const { lang } = useApp();
  const tabs = role === 'owner' ? ownerTabs : cleanerTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex justify-around py-2 z-50">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) =>
          `flex flex-col items-center text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}`
        }>
          <Icon size={20} />
          <span className="mt-0.5">{t(label, lang)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
