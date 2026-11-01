import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
export default function Settings() {
  const { lang } = useApp();
  return <div className="p-4"><h1 className="page-title">{t('settings', lang)}</h1><p className="mt-2 text-muted">Coming soon...</p></div>;
}
