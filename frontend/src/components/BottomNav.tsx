import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { ownerNav, cleanerNav } from './navItems';
import { useUnreadCount } from './useUnreadCount';

export default function BottomNav() {
  const { role } = useAuth();
  const { lang } = useApp();
  const tabs = (role === 'owner' ? ownerNav : cleanerNav).filter(i => !i.desktopOnly);
  const unread = useUnreadCount(role === 'cleaner');

  return (
    <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line flex px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) =>
          `flex-1 flex flex-col items-center gap-1 pt-2 pb-1 text-[11px] ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
        }>
          <span className="relative">
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            {label === 'notifications' && unread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
          {t(label, lang)}
        </NavLink>
      ))}
    </nav>
  );
}
