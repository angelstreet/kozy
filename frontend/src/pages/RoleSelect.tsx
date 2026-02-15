import { useAuth } from '@/contexts/AuthContext';

import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';

export default function RoleSelect() {
  const { setRole } = useAuth();
  const { lang } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm text-center">
        <div className="absolute top-4 right-4">
          
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">🏠 Kozy</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{t('selectRole', lang) || 'How will you use Kozy?'}</p>
        <div className="space-y-3">
          <button
            onClick={() => setRole('owner')}
            className="w-full bg-blue-500 text-white rounded-xl py-4 text-lg font-medium hover:bg-blue-600 transition"
          >
            🏡 {t('owner', lang) || 'Property Owner'}
          </button>
          <button
            onClick={() => setRole('cleaner')}
            className="w-full bg-green-500 text-white rounded-xl py-4 text-lg font-medium hover:bg-green-600 transition"
          >
            🧹 {t('cleaner', lang) || 'Cleaner'}
          </button>
        </div>
      </div>
    </div>
  );
}
