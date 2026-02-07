import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

export default function Layout() {
  const { logout } = useAuth();
  const { lang, setLang, dark, toggleDark } = useApp();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-16">
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <span className="font-bold text-lg">🏠 Kozy</span>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500 font-medium">{lang.toUpperCase()}</button>
          <button onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
          <button onClick={logout} className="text-red-500">↗</button>
        </div>
      </header>
      <Outlet />
      <BottomNav />
    </div>
  );
}
