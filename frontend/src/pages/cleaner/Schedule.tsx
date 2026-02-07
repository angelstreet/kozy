import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
export default function Schedule() {
  const { lang } = useApp();
  return <div className="p-4"><h1 className="text-2xl font-bold">{t('schedule', lang)}</h1><p className="mt-2 text-gray-500">Coming soon...</p></div>;
}
