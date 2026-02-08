import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, ArrowRight, Check, Loader2, X, Mail, MessageCircle, Copy, Share2, RotateCcw } from 'lucide-react';

interface Cleaner { id: number; name: string; email: string; phone?: string; status: string; invite_token?: string; invite_method?: string; invite_sent_at?: string; }
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
            <CleanerCard key={c.id} cleaner={c} onRefresh={loadCleaners} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Cleaner Card with invite actions ---
function CleanerCard({ cleaner: c, onRefresh }: { cleaner: Cleaner; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = c.invite_token ? `${window.location.origin}/kozy/invite/${c.invite_token}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const phone = c.phone?.replace(/\D/g, '') || '';
    const msg = encodeURIComponent(`Hi ${c.name}! You're invited to join Kozy for managing your cleaning schedule. Accept here: ${inviteUrl}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const resendInvite = async () => {
    await apiFetch(`/cleaners/${c.id}/resend-invite`, { method: 'POST' });
    onRefresh();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">{c.name}</h3>
          {c.email && <p className="text-sm text-gray-500">{c.email}</p>}
          {c.phone && <p className="text-sm text-gray-400">{c.phone}</p>}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          c.status === 'active' ? 'bg-green-100 text-green-700' :
          c.status === 'invited' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {c.status === 'invited' ? '📨 Invited' : c.status}
        </span>
      </div>

      {c.status === 'invited' && c.invite_token && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={copyLink} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {c.invite_method === 'whatsapp' && c.phone && (
            <button onClick={shareWhatsApp} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
              <MessageCircle size={14} /> Send WhatsApp
            </button>
          )}
          <button onClick={resendInvite} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
            <RotateCcw size={14} /> Resend
          </button>
        </div>
      )}
    </div>
  );
}

// --- Add Housekeeper Wizard (3 steps: Info → Assign → Invite method) ---
function AddHousekeeperWizard({ properties, onClose }: { properties: any[]; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', language: 'fr' });
  const [inviteMethod, setInviteMethod] = useState<'email' | 'whatsapp'>('whatsapp');
  const [assignments, setAssignments] = useState<Record<number, 'primary' | 'backup' | null>>({});
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const totalSteps = 3;

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

  const canNext1 = form.name.trim() && (inviteMethod === 'email' ? form.email.trim() : form.phone.trim());

  const submit = async () => {
    setSaving(true);
    try {
      const property_assignments = Object.entries(assignments)
        .filter(([, r]) => r)
        .map(([propId, role]) => ({ property_id: Number(propId), role }));

      const res = await apiFetch('/cleaners/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email || undefined, phone: form.phone || undefined,
          invite_method: inviteMethod, language: form.language, property_assignments
        })
      });
      const cleaner = await res.json();
      if (cleaner.error) { alert(cleaner.error); setSaving(false); return; }
      setResult(cleaner);
      setStep(4); // success step
    } catch { alert('Failed to create cleaner'); }
    setSaving(false);
  };

  const inviteUrl = result?.invite_token ? `${window.location.origin}/kozy/invite/${result.invite_token}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const phone = form.phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hi ${form.name}! You're invited to join Kozy for managing your cleaning schedule. Accept here: ${inviteUrl}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const activeAssignments = Object.entries(assignments).filter(([, r]) => r);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button onClick={() => step > 1 && step < 4 ? setStep(step - 1) : onClose()}><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-lg flex-1">{step === 4 ? 'Invite Sent!' : 'Add Housekeeper'}</h1>
        {step < 4 && <span className="text-sm text-gray-400">Step {step}/{totalSteps}</span>}
      </header>

      {step < 4 && (
        <div className="flex gap-1 px-4 pt-3">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
      )}

      <div className="p-4">
        {/* Step 1: Info + invite method */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">How will you invite them?</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setInviteMethod('whatsapp')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${inviteMethod === 'whatsapp' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <MessageCircle size={24} className={`mx-auto mb-1 ${inviteMethod === 'whatsapp' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">WhatsApp</span>
                </button>
                <button onClick={() => setInviteMethod('email')}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${inviteMethod === 'email' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <Mail size={24} className={`mx-auto mb-1 ${inviteMethod === 'email' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">Email</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input value={form.name} onChange={e => upd('name', e.target.value)}
                placeholder="e.g. Marie Dupont"
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
            </div>
            {inviteMethod === 'whatsapp' && (
              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input value={form.phone} onChange={e => upd('phone', e.target.value)} type="tel"
                  placeholder="+33 6 12 34 56 78"
                  className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
              </div>
            )}
            {inviteMethod === 'email' && (
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input value={form.email} onChange={e => upd('email', e.target.value)} type="email"
                  placeholder="marie@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
              </div>
            )}
            {inviteMethod === 'whatsapp' && (
              <div>
                <label className="block text-sm font-medium mb-1">Email (optional)</label>
                <input value={form.email} onChange={e => upd('email', e.target.value)} type="email"
                  placeholder="marie@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
              </div>
            )}
            {inviteMethod === 'email' && (
              <div>
                <label className="block text-sm font-medium mb-1">Phone (optional)</label>
                <input value={form.phone} onChange={e => upd('phone', e.target.value)} type="tel"
                  placeholder="+33 6 12 34 56 78"
                  className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <select value={form.language} onChange={e => upd('language', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 outline-none">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <button disabled={!canNext1} onClick={() => setStep(2)}
              className="w-full bg-blue-500 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4">
              Next <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Assign to properties */}
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

            <button onClick={() => setStep(3)}
              className="w-full bg-blue-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4">
              Next <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 3: Review & confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Review & Send Invite</h2>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xl">🧹</div>
                <div>
                  <p className="font-bold text-lg">{form.name}</p>
                  <p className="text-sm text-gray-500">
                    {inviteMethod === 'whatsapp' ? `📱 ${form.phone}` : `📧 ${form.email}`}
                  </p>
                </div>
              </div>

              {activeAssignments.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-3">
                  <p className="text-xs text-gray-400 uppercase mb-1">Properties</p>
                  {activeAssignments.map(([propId, role]) => {
                    const prop = properties.find(p => p.id === Number(propId));
                    return (
                      <p key={propId} className="text-sm">
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: prop?.color }} />
                        {prop?.name} <span className="text-gray-400">({role})</span>
                      </p>
                    );
                  })}
                </div>
              )}

              <div className="border-t dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-400 uppercase mb-1">Invite via</p>
                <p className="text-sm flex items-center gap-2">
                  {inviteMethod === 'whatsapp' ? <><MessageCircle size={16} className="text-green-600" /> WhatsApp</> : <><Mail size={16} className="text-blue-600" /> Email</>}
                </p>
              </div>
            </div>

            <button disabled={saving} onClick={submit}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-green-500/25">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
              {saving ? 'Creating...' : 'Create & Generate Invite'}
            </button>
          </div>
        )}

        {/* Step 4: Success — share invite link */}
        {step === 4 && result && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Invite Ready!</h2>
            <p className="text-gray-500">{form.name} has been added. Share the invite link below.</p>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm break-all text-left font-mono text-gray-600 dark:text-gray-400">
              {inviteUrl}
            </div>

            <div className="flex gap-3">
              <button onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 font-medium text-sm hover:bg-gray-300">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              {inviteMethod === 'whatsapp' && (
                <button onClick={shareWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-medium text-sm hover:bg-green-600 shadow-lg shadow-green-500/25">
                  <MessageCircle size={16} /> Send WhatsApp
                </button>
              )}
            </div>

            <button onClick={onClose}
              className="w-full py-3 rounded-xl border dark:border-gray-700 font-medium text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 mt-2">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
