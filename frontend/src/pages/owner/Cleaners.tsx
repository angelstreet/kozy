import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/i18n';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import CleanerMessages from '@/components/CleanerMessages';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, ArrowRight, Check, Loader2, X, Phone, Mail, Pencil, Trash2, ChevronRight, Users, Sparkles } from 'lucide-react';

interface Cleaner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  property_count: number;
}

interface CleanerDetail extends Cleaner {
  clerk_user_id?: string | null;
  language?: string | null;
  assignments: { property_id: number; property_name: string; role: 'primary' | 'backup' }[];
}

// ─── Main Cleaners Page ───────────────────────────────────────────────────────

export default function Cleaners() {
  const { lang, fetchCached, invalidateCache } = useApp();
  const { properties, loading: propLoading, isEmpty } = useProperties();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'edit'>('list');
  const [selected, setSelected] = useState<CleanerDetail | null>(null);

  const loadCleaners = async () => {
    try {
      const data = await fetchCached('/cleaners', true);
      setCleaners(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadCleaners(); }, []);

  if (loading || propLoading) return <div className="p-4 text-center text-muted pt-20">Loading...</div>;

  if (isEmpty) {
    return (
      <div className="p-4">
        <h1 className="page-title mb-4">{t('cleaners', lang)}</h1>
        <EmptyState emoji="🧹" title="Add a property first" subtitle="Once you have a property, you can add cleaners and assign them." ctaLabel="+ Add Property" ctaTo="/add-property" />
      </div>
    );
  }

  const openDetail = async (id: number) => {
    try {
      const res = await apiFetch(`/cleaners/${id}`);
      const data = await res.json();
      setSelected(data);
      setView('detail');
    } catch {}
  };

  if (view === 'add') {
    return <CleanerForm properties={properties} onClose={() => { setView('list'); loadCleaners(); }} />;
  }

  if (view === 'detail' && selected) {
    return (
      <CleanerDetail
        cleaner={selected}
        properties={properties}
        onBack={() => { setView('list'); loadCleaners(); }}
        onEdit={() => setView('edit')}
        onRefresh={async () => {
          const res = await apiFetch(`/cleaners/${selected.id}`);
          setSelected(await res.json());
          loadCleaners();
        }}
      />
    );
  }

  if (view === 'edit' && selected) {
    return (
      <CleanerForm
        cleaner={selected}
        properties={properties}
        onClose={() => {
          setView('detail');
          openDetail(selected.id);
        }}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">{t('cleaners', lang)}</h1>
        <button onClick={() => setView('add')} className="bg-accent text-accent-ink p-2 rounded-xl shadow-sm hover:bg-accent-hover transition-colors">
          <Plus size={20} />
        </button>
      </div>

      {cleaners.length === 0 ? (
        <EmptyState emoji="🧹" title="No cleaners yet" subtitle="Add your first cleaner to start assigning them to properties." ctaLabel="+ Add Cleaner" ctaTo="" />
      ) : (
        <div className="space-y-3">
          {cleaners.map(c => (
            <button
              key={c.id}
              onClick={() => openDetail(c.id)}
              className="w-full bg-surface rounded-xl p-4 flex items-center gap-4 text-left hover:bg-page transition-colors border border-line"
            >
              <div className="w-11 h-11 rounded-full bg-tint text-accent flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.name}</p>
                {c.email && <p className="text-sm text-muted truncate">{c.email}</p>}
                {c.phone && <p className="text-sm text-muted">{c.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs bg-page text-muted px-2 py-1 rounded-full flex items-center gap-1">
                  <Users size={11} />
                  {c.property_count}
                </span>
                <ChevronRight size={16} className="text-muted" />
              </div>
            </button>
          ))}
        </div>
      )}

      <CleanerMessages />
    </div>
  );
}

// ─── Cleaner Detail Page ──────────────────────────────────────────────────────

function CleanerDetail({
  cleaner, properties, onBack, onEdit, onRefresh
}: {
  cleaner: CleanerDetail;
  properties: any[];
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [assignMode, setAssignMode] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, 'primary' | 'backup' | null>>(() => {
    const map: Record<number, 'primary' | 'backup'> = {};
    cleaner.assignments.forEach(a => { map[a.property_id] = a.role; });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete ${cleaner.name}? This cannot be undone.`)) return;
    setDeleting(true);
    await apiFetch(`/cleaners/${cleaner.id}`, { method: 'DELETE' });
    onBack();
  };

  const toggleProp = (id: number) => {
    setAssignments(a => {
      if (a[id]) { const n = { ...a }; delete n[id]; return n; }
      return { ...a, [id]: 'primary' };
    });
  };

  const setRole = (id: number, role: 'primary' | 'backup') => {
    setAssignments(a => ({ ...a, [id]: role }));
  };

  const saveAssignments = async () => {
    setSaving(true);
    const list = Object.entries(assignments)
      .filter(([, r]) => r)
      .map(([propId, role]) => ({ property_id: Number(propId), role }));
    await apiFetch(`/cleaners/${cleaner.id}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: list }),
    });
    setSaving(false);
    setAssignMode(false);
    onRefresh();
  };

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="flex items-center gap-3 px-4 py-3 bg-surface border-b">
        <button onClick={onBack}><ArrowLeft size={20} /></button>
        <h1 className="font-semibold text-lg flex-1 truncate">{cleaner.name}</h1>
        <button onClick={onEdit} className="text-accent hover:text-accent p-1">
          <Pencil size={18} />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="text-danger hover:text-red-400 p-1">
          {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
        </button>
      </header>

      <div className="p-4 space-y-5">
        {/* Info card */}
        <div className="bg-surface rounded-xl p-5 space-y-3 border border-line">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-tint text-accent flex items-center justify-center"><Sparkles size={28} strokeWidth={1.75} /></div>
            <div>
              <h2 className="text-xl font-semibold">{cleaner.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                cleaner.status === 'active' ? 'bg-tint text-accent' :
                cleaner.status === 'invited' ? 'bg-warn-tint text-warn' :
                'bg-page text-muted'
              }`}>{cleaner.status}</span>
            </div>
          </div>

          {cleaner.email && (
            <div className="flex items-center gap-3 text-sm text-muted">
              <Mail size={16} className="flex-shrink-0" />
              <span>{cleaner.email}</span>
            </div>
          )}
          {cleaner.phone && (
            <div className="flex items-center gap-3 text-sm text-muted">
              <Phone size={16} className="flex-shrink-0" />
              <span>{cleaner.phone}</span>
            </div>
          )}
        </div>

        <AppAccess cleaner={cleaner} />

        {/* Assignments */}
        <div className="bg-surface rounded-xl overflow-hidden border border-line">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Properties</h3>
            <button
              onClick={() => setAssignMode(m => !m)}
              className="text-sm text-accent hover:text-accent font-medium"
            >
              {assignMode ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {!assignMode ? (
            <div>
              {cleaner.assignments.length === 0 ? (
                <p className="text-sm text-muted px-4 py-4">No properties assigned yet.</p>
              ) : (
                cleaner.assignments.map(a => (
                  <div key={a.property_id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                    <span className="font-medium text-sm">{a.property_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.role === 'primary' ? 'bg-tint text-accent' : 'bg-warn-tint text-warn'
                    }`}>{a.role}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {properties.map(p => (
                <div key={p.id} className={`rounded-xl border-2 p-3 transition-all ${assignments[p.id] ? 'border-accent bg-tint' : 'border-line'}`}>
                  <button onClick={() => toggleProp(p.id)} className="w-full flex items-center gap-3 text-left">
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: assignments[p.id] ? '#3B82F6' : '#D1D5DB', backgroundColor: assignments[p.id] ? '#3B82F6' : 'transparent' }}>
                      {assignments[p.id] && <Check size={12} className="text-white" />}
                    </div>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium">{p.name}</span>
                  </button>
                  {assignments[p.id] && (
                    <div className="flex gap-2 mt-2 ml-8">
                      <button onClick={() => setRole(p.id, 'primary')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${assignments[p.id] === 'primary' ? 'bg-accent text-accent-ink' : 'bg-page text-muted'}`}>
                        Primary
                      </button>
                      <button onClick={() => setRole(p.id, 'backup')}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${assignments[p.id] === 'backup' ? 'bg-orange-500 text-white' : 'bg-page text-muted'}`}>
                        Backup
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={saveAssignments}
                disabled={saving}
                className="w-full bg-accent hover:bg-accent-hover disabled:bg-gray-300 text-accent-ink font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 mt-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Assignments
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Cleaner Form ──────────────────────────────────────────────────

function CleanerForm({ cleaner, properties, onClose }: {
  cleaner?: CleanerDetail;
  properties: any[];
  onClose: () => void;
}) {
  const isEdit = !!cleaner;
  const [form, setForm] = useState({ name: cleaner?.name || '', email: cleaner?.email || '', phone: cleaner?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await apiFetch(`/cleaners/${cleaner!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email || null, phone: form.phone || null }),
        });
      } else {
        await apiFetch('/cleaners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email || null, phone: form.phone || null }),
        });
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="flex items-center gap-3 px-4 py-3 bg-surface border-b">
        <button onClick={onClose}><ArrowLeft size={20} /></button>
        <h1 className="font-semibold text-lg">{isEdit ? 'Edit Cleaner' : 'Add Cleaner'}</h1>
      </header>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            value={form.name}
            onChange={e => upd('name', e.target.value)}
            placeholder="e.g. Marie Dupont"
            className="w-full px-3 py-2.5 rounded-xl border bg-surface outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={form.email}
            onChange={e => upd('email', e.target.value)}
            type="email"
            placeholder="marie@example.com"
            className="w-full px-3 py-2.5 rounded-xl border bg-surface outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={e => upd('phone', e.target.value)}
            type="tel"
            placeholder="+33 6 12 34 56 78"
            className="w-full px-3 py-2.5 rounded-xl border bg-surface outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-danger text-sm bg-danger-tint rounded-lg p-3">
            <X size={16} />
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || !form.name.trim()}
          className="w-full bg-accent hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-accent-ink font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {isEdit ? 'Save Changes' : 'Add Cleaner'}
        </button>
      </div>
    </div>
  );
}

// ─── App account: invite by WhatsApp, or linked ───────────────────────────────

function AppAccess({ cleaner }: { cleaner: CleanerDetail }) {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [note, setNote] = useState('');

  const send = async () => {
    setState('busy');
    const res = await apiFetch(`/cleaning/invite/${cleaner.id}`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setState('sent');
      setNote(d.status === 'dry_run' ? (fr ? 'Mode test : visible dans les messages, rien n’est envoyé.' : 'Test mode: shown in messages, nothing sent.') : (fr ? 'Invitation envoyée par WhatsApp.' : 'Invite sent by WhatsApp.'));
    } else { setState('error'); setNote(d.error || 'Error'); }
  };

  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{fr ? 'Application Kozy' : 'Kozy app'}</p>
        <p className="text-xs text-muted">{cleaner.clerk_user_id
          ? (fr ? 'Compte créé : elle voit son planning dans l’app.' : 'Account created: she sees her planning in the app.')
          : note || (fr ? 'Pas encore de compte. L’invitation contient le lien pour en créer un.' : 'No account yet. The invite holds the link to create one.')}</p>
      </div>
      {cleaner.clerk_user_id
        ? <span className="pill bg-tint text-accent"><Check size={14} aria-hidden />{fr ? 'Actif' : 'Active'}</span>
        : (
          <button className="btn-secondary text-sm" onClick={send} disabled={state === 'busy'}>
            {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : null}
            {state === 'sent' ? (fr ? 'Renvoyer' : 'Send again') : (fr ? 'Envoyer l’invitation' : 'Send invite')}
          </button>
        )}
    </div>
  );
}
