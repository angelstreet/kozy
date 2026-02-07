import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, CreditCard, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CleanerMore() {
  const { lang, dark, toggleDark, setLang } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const items = [
    { icon: ShoppingCart, label: 'Shopping Requests', desc: 'View shopping requests from owners', onClick: () => {} },
    { icon: CreditCard, label: 'Payments', desc: 'Track your earnings and payments', onClick: () => {} },
    { icon: Settings, label: 'Settings', desc: 'Preferences and account', onClick: () => {} },
  ];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('more', lang)}</h1>
      <div className="space-y-2">
        {items.map(({ icon: Icon, label, desc, onClick }) => (
          <button key={label} onClick={onClick}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 text-left">
            <Icon size={20} className="text-gray-400" />
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          </button>
        ))}

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <span className="font-medium">Theme</span>
            <button onClick={toggleDark} className="text-xl">{dark ? '☀️' : '🌙'}</button>
          </div>
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <span className="font-medium">Language</span>
            <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-blue-500 font-medium">{lang.toUpperCase()}</button>
          </div>
          <button onClick={logout}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 text-red-500">
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
