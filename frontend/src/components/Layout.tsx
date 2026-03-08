import { Outlet, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { lazy, Suspense } from 'react';
import Calendar from '@/pages/owner/Calendar';
import Analytics from '@/pages/owner/Analytics';

const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function UserBtn() {
  if (!clerkEnabled) return null;
  try {
    const { UserButton } = require('@clerk/clerk-react');
    return <UserButton afterSignOutUrl="/kozy/" />;
  } catch { return null; }
}

export default function Layout() {
  const { role, logout, setRole } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();
  const location = useLocation();
  const path = location.pathname;
  const isCalendar = path.endsWith('/calendar');
  const isAnalytics = path.endsWith('/analytics');
  const isCachedPage = isCalendar || isAnalytics;

  const toggleRole = () => {
    setRole(role === 'owner' ? 'cleaner' : 'owner');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
  <Sidebar />
  <div className="flex-1 lg:ml-16 xl:ml-64 overflow-x-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <img src="/kozy/logo.png" alt="Kozy" className="lg:hidden h-7" />
        <div className="flex items-center gap-2 text-sm">
          <button onClick={toggleRole} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-medium">
            <span>{role === 'owner' ? '👑' : '🧹'}</span>
            <span className="capitalize">{role}</span>
            <span className="text-gray-400 text-[10px]">⇄</span>
          </button>
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500 font-medium">{lang.toUpperCase()}</button>
          <button onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
          {role === 'cleaner' && <NotificationBell />}
          {clerkEnabled ? <UserBtn /> : <button onClick={logout} className="text-red-400 text-xs">⏻</button>}
        </div>
      </header>
      <div className="pb-20 lg:pb-0">
        {role === 'owner' && (
          <>
            <div style={{ display: isCalendar ? 'block' : 'none' }}><Calendar /></div>
            <div style={{ display: isAnalytics ? 'block' : 'none' }}><Analytics /></div>
          </>
        )}
        {!isCachedPage && <Outlet />}
      </div>
      <BottomNav />
    </div>
  </div>
  );
}
