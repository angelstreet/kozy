import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

export default function Layout() {
  const { role, logout, setRole } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();

  const toggleRole = () => {
    setRole(role === 'owner' ? 'cleaner' : 'owner');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-16">
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <span className="font-bold text-lg">🏠 Kozy</span>
        <div className="flex items-center gap-2 text-sm">
          {/* Role toggle */}
          <button
            onClick={toggleRole}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-medium"
          >
            <span>{role === 'owner' ? '👑' : '🧹'}</span>
            <span className="capitalize">{role}</span>
            <span className="text-gray-400 text-[10px]">⇄</span>
          </button>
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500 font-medium">{lang.toUpperCase()}</button>
          <button onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
          <UserButton afterSignOutUrl="/kozy/" />
        </div>
      </header>
      <Outlet />
      <BottomNav />
    </div>
  );
}
