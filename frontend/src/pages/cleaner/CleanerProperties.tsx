import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';

export default function CleanerProperties() {
  const { lang, fetchCached } = useApp();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCached('/properties').then(setProperties).catch(() => {}).finally(() => setLoading(false));
  }, [fetchCached]);

  if (loading) return <div className="p-4 text-center text-muted">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="page-title mb-4">{t('properties', lang)}</h1>
      {properties.length === 0 ? (
        <EmptyState emoji="🏘️" title="No assigned properties" subtitle="Properties assigned to you will appear here." />
      ) : (
        <div className="space-y-3">
          {properties.map(p => (
            <div key={p.id} className="bg-surface rounded-xl p-4 border border-line">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                <h3 className="font-semibold text-lg">{p.name}</h3>
              </div>
              {p.address && <p className="text-sm text-muted">{p.address}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
