import { Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { ArrowLeftRight, Globe, LogOut, Moon, Sun } from 'lucide-react';
import NotificationBell from './NotificationBell';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Logo from './Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import Calendar from '@/pages/owner/Calendar';
import Analytics from '@/pages/owner/Analytics';

const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function Layout() {
  const { role, logout, setRole } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();
  const path = useLocation().pathname;
  const isCalendar = path.endsWith('/calendar');
  const isAnalytics = path.endsWith('/analytics');
  const fr = lang === 'fr';
  const otherRole = role === 'owner' ? 'cleaner' : 'owner';
  const switchLabel = fr
    ? (otherRole === 'cleaner' ? 'Passer en vue ménage' : 'Passer en vue propriétaire')
    : (otherRole === 'cleaner' ? 'Switch to cleaner view' : 'Switch to owner view');

  return (
    <div className="min-h-screen bg-page text-ink">
      <Sidebar />
      <div className="lg:ml-16 xl:ml-60 overflow-x-hidden">
        <header className="sticky top-0 z-30 h-14 lg:h-16 flex items-center justify-between px-2 lg:px-6 bg-page/90 backdrop-blur border-b border-line lg:border-transparent">
          <span className="lg:hidden pl-2"><Logo /></span>
          <span className="hidden lg:block text-sm text-muted">{role === 'owner' ? (fr ? 'Propriétaire' : 'Owner') : (fr ? 'Ménage' : 'Cleaner')}</span>
          <div className="flex items-center">
            <button className="icon-btn" onClick={() => setLang(fr ? 'en' : 'fr')} title={fr ? 'English' : 'Français'} aria-label={fr ? 'Switch to English' : 'Passer en français'}>
              <span className="relative"><Globe size={20} strokeWidth={1.75} /><span className="absolute -bottom-1.5 -right-2 text-[9px] font-semibold">{lang.toUpperCase()}</span></span>
            </button>
            <button className="icon-btn" onClick={toggleDark} title={dark ? (fr ? 'Thème clair' : 'Light theme') : (fr ? 'Thème sombre' : 'Dark theme')} aria-label={dark ? 'Light theme' : 'Dark theme'}>
              {dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
            </button>
            <button className="icon-btn" onClick={() => setRole(otherRole)} title={switchLabel} aria-label={switchLabel}>
              <ArrowLeftRight size={20} strokeWidth={1.75} />
            </button>
            {role === 'cleaner' && <NotificationBell />}
            <span className="w-11 h-11 flex items-center justify-center">
              {clerkEnabled
                ? <UserButton afterSignOutUrl="/" />
                : <button className="icon-btn" onClick={logout} title={fr ? 'Se déconnecter' : 'Sign out'} aria-label="Sign out"><LogOut size={20} strokeWidth={1.75} /></button>}
            </span>
          </div>
        </header>
        <main className="pb-24 lg:pb-8">
          {role === 'owner' && (
            <>
              <div style={{ display: isCalendar ? 'block' : 'none' }}><Calendar /></div>
              <div style={{ display: isAnalytics ? 'block' : 'none' }}><Analytics /></div>
            </>
          )}
          {!(isCalendar || isAnalytics) && <div className="max-w-[1120px] mx-auto"><Outlet /></div>}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
