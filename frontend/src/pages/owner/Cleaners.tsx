import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';

interface Cleaner { id: number; name: string; email: string; phone?: string; status: string; }
interface Assignment { property_id: number; role: 'primary' | 'backup'; }

export default function Cleaners() {
  const { lang, fetchCached, invalidateCache } = useApp();
  const { properties, loading: propLoading, isEmpty } = useProperties();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const loadCleaners = async () => {
    try {
      const data = await fetchCached('/kozy/api/cleaners', true);
      setCleaners(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadCleaners(); }, []);

  if (loading || propLoading) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t('cleaners', lang)}</h1>
        <EmptyState emoji="🧹" title="Add a property first" subtitle="Once you have a property, you can invite your cleaners and assign them." ctaLabel="+ Add Property" ctaTo="/add-property" />
      </div>
    );
  }

  if (showWizard) {
    return <AddHousekeeperWizard properties={properties} onClose={() => { setShowWizard(false); loadCleaners(); }} />;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('cleaners', lang)}</h1>
        <button onClick={() => setShowWizard(true)} className="bg-blue-500 text-white p-2 rounded-xl shadow-sm">
          <Plus size={20} />
        </button>
      </div>

      {cleaners.length === 0 ? (
        <EmptyState emoji="🧹" title="No cleaners yet" subtitle="Add your first housekeeper to start assigning them to properties." ctaLabel="+ Add Housekeeper" ctaTo="" />
      ) : (
        <div className="space-y-3">
          {cleaners.map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{c.name}</h3>
                  <p className="text-sm text-gray-500">{c.email}</p>
                  {c.phone && <p className="text-sm text-gray-400">{c.phone}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Add Housekeeper Wizard ---
function AddHousekeeperWizard({ properties, onClose }: { properties: any[]; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', language: 'fr' });
  const [assignments, setAssignments] = useState<Record<number, 'primary' | 'backup' | null>>({});

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const toggleProp = (id: number) => {
    setAssignments(a => {
      if (a[id]) { const n = { ...a }; delete n[id]; return n; }
      return { ...a, [id]: 'primary' as const };
    });
  };

  const setRole = (id: number, role: 'primary' | 'backup') => {
    setAssignments(a => ({ ...a, [id]: role }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/kozy/api/cleaners', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone })
      });
      const cleaner = await res.json();

      // Assign to properties
      for (const [propId, role] of Object.entries(assignments)) {
        if (role) {
          await fetch(`/kozy/api/cleaners/${cleaner.id}/assign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ property_id: Number(propId), role })
          });
        }
      }
      onClose();
    } catch { alert('Failed to create cleaner'); }
    setSaving(false);
  };

  const activeAssignments = Object.entries(assignments).filter(([, r]) => r);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button onClick={() => step > 1 ? setStep(1) : onClose()}><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-lg flex-1">Add Housekeeper</h1>
        <span className="text-sm text-gray-400">Step {step}/2</span>
      </header>

      <div className="flex gap-1 px-4 pt-3">
        {[1, 2].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input value={form.name} onChange={e => upd('name', e.target.value)}
                placeholder="e.g. Marie Dupont"
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input value={form.email} onChange={e => upd('email', e.target.value)} type="email"
                placeholder="marie@example.com"
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} type="tel"
                placeholder="+33 6 12 34 56 78"
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <select value={form.language} onChange={e => upd('language', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <button disabled={!form.name.trim() || !form.email.trim()} onClick={() => setStep(2)}
              className="w-full bg-blue-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4">
              Next <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Assign to Properties</h2>
            <p className="text-sm text-gray-500">Select properties and choose a role for each.</p>

            <div className="space-y-2">
              {properties.map(p => (
                <div key={p.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-2 transition-all ${assignments[p.id] ? 'border-blue-500' : 'border-transparent'}`}>
                  <button onClick={() => toggleProp(p.id)} className="w-full flex items-center gap-3 text-left">
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: assignments[p.id] ? '#3B82F6' : '#D1D5DB', backgroundColor: assignments[p.id] ? '#3B82F6' : 'transparent' }}>
                      {assignments[p.id] && <Check size={14} className="text-white" />}
                    </div>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="font-medium">{p.name}</span>
                  </button>
                  {assignments[p.id] && (
                    <div className="flex gap-2 mt-3 ml-8">
                      <button onClick={() => setRole(p.id, 'primary')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${assignments[p.id] === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        Primary
                      </button>
                      <button onClick={() => setRole(p.id, 'backup')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${assignments[p.id] === 'backup' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        Backup
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {activeAssignments.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Preview</p>
                {activeAssignments.map(([propId, role]) => {
                  const prop = properties.find(p => p.id === Number(propId));
                  return <p key={propId} className="text-blue-600 dark:text-blue-400">{form.name} → {prop?.name} ({role})</p>;
                })}
              </div>
            )}

            <button disabled={saving} onClick={submit}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-green-500/25">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? 'Saving...' : 'Create Housekeeper'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
