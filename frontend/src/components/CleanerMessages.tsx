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
  const [credits, setCredits] = useState<{ id: number; name: string; counter: string | null }[]>([]);

  const load = async () => {
    const [s, m, cr] = await Promise.all([apiFetch('/cleaning/settings'), apiFetch('/cleaning/messages'), apiFetch('/cleaning/credits')]);
    if (s.ok) { const d = await s.json(); setMode(d.mode); setTestPhone(d.testPhone); }
    if (m.ok) setRows((await m.json()).messages);
    if (cr.ok) setCredits((await cr.json()).cleaners);
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

  const addPack = async (id: number, name: string) => {
    if (!confirm(fr ? `Ajouter un forfait de 6 ménages payé à ${name} ?` : `Add a paid pack of 6 cleanings for ${name}?`)) return;
    const res = await apiFetch(`/cleaning/credits/${id}/pack`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ units: 6 }),
    });
    if (res.ok) { const { counter } = await res.json(); setCredits(cs => cs.map(c => (c.id === id ? { ...c, counter } : c))); }
  };

  const runNow = async () => {
    setBusy('run'); setRunNote('');
    const res = await apiFetch('/cleaning/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sendNow: true }),
    });
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
        <button className="icon-btn" onClick={runNow} disabled={busy !== null} title={fr ? 'Envoyer les plannings maintenant' : 'Send plannings now'} aria-label={fr ? 'Envoyer les plannings maintenant' : 'Send plannings now'}>
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
            ? (fr ? 'Planning des 3 prochaines semaines par WhatsApp : le dimanche à 19h, et à 19h le jour d’un changement (tout de suite s’il touche aujourd’hui ou demain).' : 'Next 3 weeks by WhatsApp: Sunday at 19:00, and at 19:00 on the day of a change (at once if it is for today or tomorrow).')
            : mode === 'dry_run'
              ? (fr ? 'Rien n’est envoyé. Les messages prévus apparaissent ci-dessous.' : 'Nothing is sent. Planned messages show below.')
              : (fr ? 'Aucun message aux agents de ménage.' : 'No messages to cleaners.')}
        </p>
        {runNote && <p className="text-sm text-muted">{runNote}</p>}
      </div>

      {credits.length > 0 && (
        <div className="card divide-y divide-line">
          {credits.map(c => (
            <div key={c.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted">{c.counter
                  ? (fr ? 'Forfait : ménages faits / payés (dimanche et férié comptent 2)' : 'Pack: cleanings done / paid (Sunday and holidays count 2)')
                  : (fr ? 'Payé à chaque ménage' : 'Paid per cleaning')}</p>
              </div>
              {c.counter && <span className="text-sm font-semibold tabular-nums">{c.counter}</span>}
              {c.counter && (
                <button className="btn-secondary text-sm" onClick={() => addPack(c.id, c.name)}>
                  {fr ? '+6 payés' : '+6 paid'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
