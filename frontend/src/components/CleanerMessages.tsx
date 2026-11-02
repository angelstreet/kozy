import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { CheckCircle2, Clock, FlaskConical, Loader2, MessageCircle, PhoneOff, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Mode = 'off' | 'dry_run' | 'live';
interface Row { id: number; kind: string; status: string; body: string; error: string | null; created_at: string; cleaner_name: string | null }

const STATUS: Record<string, { icon: typeof Clock; fr: string; en: string; cls: string }> = {
  dry_run: { icon: FlaskConical, fr: 'Test', en: 'Test', cls: 'bg-info-tint text-info' },
  queued: { icon: Clock, fr: 'En attente', en: 'Queued', cls: 'bg-page text-muted' },
  sent: { icon: CheckCircle2, fr: 'Envoyé', en: 'Sent', cls: 'bg-tint text-accent' },
  failed: { icon: XCircle, fr: 'Échec', en: 'Failed', cls: 'bg-danger-tint text-danger' },
  no_phone: { icon: PhoneOff, fr: 'Pas de numéro', en: 'No phone', cls: 'bg-warn-tint text-warn' },
};
const KIND: Record<string, [string, string]> = {
  planning: ['Planning', 'Planning'],
  update: ['Planning modifié', 'Schedule changed'],
  reminder: ['Rappel J-1', 'Day-before reminder'],
  week: ['Semaine', 'Week plan'],
};

/** WhatsApp messages to cleaners: sending mode, run now, and what was (or would be) sent. */
export default function CleanerMessages() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [mode, setMode] = useState<Mode | null>(null);
  const [testPhone, setTestPhone] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<'mode' | 'run' | null>(null);
  const [runNote, setRunNote] = useState('');

  const load = async () => {
    const [s, m] = await Promise.all([apiFetch('/cleaning/settings'), apiFetch('/cleaning/messages')]);
    if (s.ok) { const d = await s.json(); setMode(d.mode); setTestPhone(d.testPhone); }
    if (m.ok) setRows((await m.json()).messages);
  };
  useEffect(() => { load(); }, []);

  const saveMode = async (next: Mode) => {
    if (next === 'live' && !confirm(fr
      ? 'Envoyer les messages WhatsApp aux agents de ménage pour de vrai ?'
      : 'Send the WhatsApp messages to cleaners for real?')) return;
    setBusy('mode');
    const res = await apiFetch('/cleaning/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }),
    });
    if (res.ok) { const d = await res.json(); setMode(d.mode); setTestPhone(d.testPhone); }
    setBusy(null);
  };

  const runNow = async () => {
    setBusy('run'); setRunNote('');
    const res = await apiFetch('/cleaning/run', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    setRunNote(res.ok
      ? (fr ? `${d.messages ?? 0} nouveau(x) message(s)` : `${d.messages ?? 0} new message(s)`)
      : d.error || (fr ? 'Échec' : 'Failed'));
    await load();
    setBusy(null);
  };

  return (
    <section className="space-y-3 mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title flex items-center gap-2"><MessageCircle size={18} aria-hidden />{fr ? 'Messages WhatsApp' : 'WhatsApp messages'}</h2>
        <button className="icon-btn" onClick={runNow} disabled={busy !== null} title={fr ? 'Mettre à jour maintenant' : 'Update now'} aria-label={fr ? 'Mettre à jour maintenant' : 'Update now'}>
          {busy === 'run' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
        </button>
      </div>

      <div className="card p-4 space-y-3" aria-busy={mode === null}>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-page border border-line" role="group" aria-label={fr ? 'Mode d’envoi' : 'Sending mode'}>
          {(['off', 'dry_run', 'live'] as Mode[]).map(m => (
            <button key={m} aria-pressed={mode === m} disabled={busy !== null || mode === null}
              onClick={() => mode !== m && saveMode(m)}
              className={`min-h-[36px] rounded-[9px] text-[13px] font-semibold ${mode === m ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted'}`}>
              {m === 'off' ? (fr ? 'Arrêt' : 'Off') : m === 'dry_run' ? 'Test' : 'Live'}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          {mode === 'live' && testPhone
            ? (fr ? `Test : tous les plannings partent sur votre numéro (${testPhone}), avec le nom de l’agent en tête.` : `Test: every planning goes to your number (${testPhone}), headed with the cleaner’s name.`)
            : mode === 'live'
            ? (fr ? 'Chaque agent reçoit son planning (ce mois et le suivant) par WhatsApp dès qu’il change.' : 'Each cleaner gets their planning (this month and next) by WhatsApp whenever it changes.')
            : mode === 'dry_run'
              ? (fr ? 'Rien n’est envoyé. Les messages prévus apparaissent ci-dessous.' : 'Nothing is sent. Planned messages show below.')
              : (fr ? 'Aucun message aux agents de ménage.' : 'No messages to cleaners.')}
        </p>
        {runNote && <p className="text-sm text-muted">{runNote}</p>}
      </div>

      <div className="card divide-y divide-line">
        {rows.length === 0 && <p className="p-4 text-sm text-muted">{fr ? 'Aucun message pour l’instant.' : 'No messages yet.'}</p>}
        {rows.map(r => {
          const s = STATUS[r.status] || STATUS.queued;
          const Icon = s.icon;
          return (
            <button key={r.id} className="w-full text-left px-4 py-3 hover:bg-page" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.cleaner_name || '—'} · {(KIND[r.kind] || [r.kind, r.kind])[fr ? 0 : 1]}</p>
                  <p className="text-xs text-muted">{new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleString(fr ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <span className={`pill ${s.cls}`}><Icon size={14} aria-hidden />{fr ? s.fr : s.en}</span>
              </div>
              {open === r.id && <pre className="mt-2 text-sm whitespace-pre-wrap font-sans text-ink">{r.body}</pre>}
              {open === r.id && r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
