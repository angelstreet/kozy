import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Check } from 'lucide-react';

interface ShoppingRequest {
  id: number;
  property_id: number;
  property_name: string;
  items: string;
  status: string;
  created_at: string;
}

interface Property {
  id: number;
  name: string;
}

export default function Shopping() {
  const { lang } = useApp();
  const [requests, setRequests] = useState<ShoppingRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState('');
  const [newItems, setNewItems] = useState('');

  useEffect(() => {
    fetch('/kozy/api/shopping').then(r => r.json()).then(d => setRequests(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/kozy/api/properties').then(r => r.json()).then(d => setProperties(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const submit = async () => {
    if (!newPropertyId || !newItems.trim()) return;
    const res = await fetch('/kozy/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: Number(newPropertyId), items: newItems.trim() }),
    });
    if (res.ok) {
      const sr = await res.json();
      const prop = properties.find(p => p.id === Number(newPropertyId));
      setRequests(prev => [...prev, { ...sr, property_name: prop?.name || '' }]);
      setNewItems('');
      setNewPropertyId('');
      setShowForm(false);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status === 'resolved');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('shopping', lang)}</h1>
        <button onClick={() => setShowForm(!showForm)} className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm space-y-3">
          <select value={newPropertyId} onChange={e => setNewPropertyId(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent">
            <option value="">{lang === 'fr' ? 'Sélectionner un logement' : 'Select property'}</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <textarea value={newItems} onChange={e => setNewItems(e.target.value)}
            placeholder={lang === 'fr' ? 'Articles nécessaires...' : 'Items needed...'}
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent resize-none" rows={3} />
          <button onClick={submit} className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium">
            {lang === 'fr' ? 'Envoyer' : 'Submit'}
          </button>
        </div>
      )}

      {pending.length === 0 && resolved.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
          <p>{lang === 'fr' ? 'Aucune demande' : 'No requests yet'}</p>
          <p className="text-sm mt-1">{lang === 'fr' ? 'Signalez ce qui manque dans un logement' : 'Flag what\'s needed at a property'}</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{lang === 'fr' ? 'En attente' : 'Pending'}</h2>
              <div className="space-y-2">
                {pending.map(r => (
                  <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="font-medium">{r.property_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.items}</p>
                    <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">{lang === 'fr' ? 'Résolus' : 'Resolved'}</h2>
              <div className="space-y-2">
                {resolved.map(r => (
                  <div key={r.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 opacity-60">
                    <div className="flex items-center gap-1">
                      <Check size={14} className="text-green-500" />
                      <p className="font-medium text-sm">{r.property_name}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{r.items}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
