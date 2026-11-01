import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';

import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';

export default function RoleSelect() {
  const { setRole } = useAuth();
  const { lang } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm text-center">
        <div className="absolute top-4 right-4">
          
        </div>
        <div className="flex justify-center mb-4 scale-150"><Logo /></div>
        <p className="text-muted mb-8">{t('selectRole', lang) || 'How will you use Kozy?'}</p>
        <div className="space-y-3">
          <button
            onClick={() => setRole('owner')}
            className="w-full bg-accent text-accent-ink rounded-xl py-4 text-lg font-medium hover:bg-accent-hover transition"
          >
            {t('owner', lang) || 'Property Owner'}
          </button>
          <button
            onClick={() => setRole('cleaner')}
            className="w-full bg-accent text-accent-ink rounded-xl py-4 text-lg font-medium hover:bg-accent-hover transition"
          >
            {t('cleaner', lang) || 'Cleaner'}
          </button>
        </div>
      </div>
    </div>
  );
}
