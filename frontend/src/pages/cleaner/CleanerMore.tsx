import { Moon, Sun } from 'lucide-react';
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
      <h1 className="page-title mb-4">{t('more', lang)}</h1>
      <div className="space-y-2">
        {items.map(({ icon: Icon, label, desc, onClick }) => (
          <button key={label} onClick={onClick}
            className="w-full bg-surface rounded-xl p-4 flex items-center gap-3 text-left border border-line">
            <Icon size={20} className="text-muted" />
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          </button>
        ))}

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between bg-surface rounded-xl p-4 border border-line">
            <span className="font-medium">Theme</span>
            <button onClick={toggleDark} className="icon-btn" aria-label="Theme">{dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}</button>
          </div>
          <div className="flex items-center justify-between bg-surface rounded-xl p-4 border border-line">
            <span className="font-medium">Language</span>
            <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-accent font-medium">{lang.toUpperCase()}</button>
          </div>
          <button onClick={logout}
            className="w-full bg-surface rounded-xl p-4 flex items-center gap-3 text-danger border border-line">
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
