import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { ownerNav, cleanerNav } from './navItems';
import { useUnreadCount } from './useUnreadCount';
import Logo from './Logo';

export default function Sidebar() {
  const { role } = useAuth();
  const { lang } = useApp();
  const items = role === 'owner' ? ownerNav : cleanerNav;
  const unread = useUnreadCount(role === 'cleaner');

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 xl:w-60 bg-surface border-r border-line z-40 hidden lg:flex flex-col">
      <div className="h-16 px-4 flex items-center"><Logo compact /></div>
      <nav aria-label="Main" className="flex-1 px-2 xl:px-3 space-y-1">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} title={t(label, lang)} className={({ isActive }) =>
            `flex items-center gap-3 h-11 px-3 rounded-xl text-sm ${isActive ? 'bg-tint text-accent font-semibold' : 'text-muted hover:bg-page hover:text-ink'}`
          }>
            <span className="relative">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              {label === 'notifications' && unread > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <span className="hidden xl:block">{t(label, lang)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
