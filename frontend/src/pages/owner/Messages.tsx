import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarCheck, Car, CheckCircle2, ChevronDown, Eye, KeyRound, Loader2, LogOut, MapPin,
  MessageSquare, Send, ShoppingBag, Star, Trash2, type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { TEMPLATE_LABELS, isBlock } from './Dashboard';

type Mode = 'off' | 'dry_run' | 'live';
interface Template { key: string; anchor: 'booking' | 'arrival' | 'departure' | 'manual'; offsetDays: number; sendTime: string | null; active: boolean }
interface Planned { bookingId: number; templateKey: string; channel: string; guestName: string; sendAt: string; due: boolean; body: string }
interface LogRow { smoobu_booking_id: number; template_key: string; mode: string; status: string; guest_name: string; created_at: string; error: string | null }
interface Booking { id: number; reference_id?: string | null; guest_name: string; property_name: string; checkin_date: string; checkout_date: string; channel_name?: string | null; source?: string | null; price?: number | null }

const CHANNELS = ['Airbnb', 'Booking.com', 'Direct booking'];

const RULE_ICONS: Record<string, LucideIcon> = {
  confirmation: CalendarCheck, pre_arrival: MessageSquare, checkin: KeyRound,
  checkout_reminder: Trash2, checkout_day: LogOut, review: Star,
};
const REPLY_ICONS: Record<string, LucideIcon> = { reply_parking: Car, reply_linen: MessageSquare, reply_address: MapPin, reply_shops: ShoppingBag };
const REPLY_LABELS: Record<string, [string, string]> = {
  reply_parking: ['Parking', 'Parking'],
  reply_linen: ['Linen and towels', 'Linge et serviettes'],
  reply_address: ['Address and transport', 'Adresse et transports'],
  reply_shops: ['Shops nearby', 'Commerces'],
};

function timing(t: Template, fr: boolean): string {
  if (t.anchor === 'booking') return fr ? 'Juste après la réservation' : 'Right after booking';
  const base = t.anchor === 'arrival' ? (fr ? 'l’arrivée' : 'arrival') : (fr ? 'départ' : 'departure');
  const day = t.offsetDays === 0
    ? (t.anchor === 'arrival' ? (fr ? 'Jour d’arrivée' : 'Arrival day') : (fr ? 'Jour du départ' : 'Departure day'))
    : t.offsetDays < 0
      ? (fr ? `${-t.offsetDays} j avant ${base === 'départ' ? 'le départ' : base}` : `${-t.offsetDays === 1 ? 'Day' : `${-t.offsetDays} days`} before ${base}`)
      : (fr ? `${t.offsetDays} j après ${base === 'départ' ? 'le départ' : base}` : `${t.offsetDays === 1 ? 'Day' : `${t.offsetDays} days`} after ${base}`);
  return t.sendTime ? `${day} · ${t.sendTime}` : day;
}

function Switch({ on, label, onChange, busy }: { on: boolean; label: string; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
      className={`relative w-11 h-[26px] rounded-full flex-none transition-colors ${on ? 'bg-accent' : 'bg-line'} disabled:opacity-60`}
    >
      <span className={`absolute top-[3px] w-5 h-5 rounded-full transition-all ${on ? 'right-[3px] bg-accent-ink' : 'left-[3px] bg-surface'}`} />
    </button>
  );
}

export default function Messages() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const locale = fr ? 'fr-FR' : 'en-GB';
  const label = (key: string) => (TEMPLATE_LABELS[key] || REPLY_LABELS[key] || [key, key])[fr ? 1 : 0];

  const [mode, setMode] = useState<Mode | null>(null);
  const [liveChannels, setLiveChannels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [planned, setPlanned] = useState<Planned[] | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [open, setOpen] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const [s, t, l] = await Promise.all([
        apiFetch('/messaging/settings').then(r => r.json()),
        apiFetch('/messaging/templates').then(r => r.json()),
        apiFetch('/messaging/log?limit=10').then(r => r.json()),
      ]);
      setMode(s.mode); setLiveChannels(s.liveChannels || []);
      setTemplates(t.templates || []); setLog(l.log || []);
      apiFetch('/messaging/preview?days=7').then(r => r.json()).then(p => setPlanned(p.messages || [])).catch(() => setPlanned([]));
      apiFetch('/bookings').then(r => r.json()).then(b => setBookings(Array.isArray(b) ? b : [])).catch(() => {});
    } catch {
      setError(fr ? 'Impossible de charger les messages. Réessayez.' : 'Could not load messages. Try again.');
    }
  }, [fr]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (nextMode: Mode, channels = liveChannels) => {
    if (nextMode === 'live' && mode !== 'live') {
      const ok = window.confirm(fr
        ? 'Les messages partiront vraiment aux voyageurs, sur les canaux choisis. Continuer ?'
        : 'Messages will really reach guests on the chosen channels. Continue?');
      if (!ok) return;
    }
    setBusyKey('settings');
    const res = await apiFetch('/messaging/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode, liveChannels: channels }),
    });
    if (res.ok) { const s = await res.json(); setMode(s.mode); setLiveChannels(s.liveChannels || []); }
    setBusyKey('');
  };

  const toggleTemplate = async (key: string, active: boolean) => {
    setBusyKey(key);
    const res = await apiFetch(`/messaging/templates/${key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    });
    if (res.ok) setTemplates(ts => ts.map(t => (t.key === key ? { ...t, active } : t)));
    setBusyKey('');
  };

  const rules = templates.filter(t => t.anchor !== 'manual');
  const replies = templates.filter(t => t.anchor === 'manual');

  return (
    <div className="px-4 lg:px-8 pt-2 pb-6 space-y-5 max-w-[720px]">
      <div>
        <h1 className="page-title">{fr ? 'Messages automatiques' : 'Automatic messages'}</h1>
        <p className="text-sm text-muted mt-1">{fr ? 'Envoyés via Smoobu, dans la langue du voyageur.' : 'Sent through Smoobu, in the guest’s language.'}</p>
      </div>

      {error && (
        <div className="card p-4 flex items-center gap-3 text-danger"><AlertCircle size={20} aria-hidden />{error}</div>
      )}

      <section className="card p-4 space-y-3" aria-busy={mode === null}>
        <h2 className="section-title">{fr ? 'Envoi' : 'Sending'}</h2>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-page border border-line" role="group" aria-label={fr ? 'Mode d’envoi' : 'Sending mode'}>
          {(['off', 'dry_run', 'live'] as Mode[]).map(m => (
            <button key={m} aria-pressed={mode === m} disabled={busyKey === 'settings' || mode === null}
              onClick={() => mode !== m && saveSettings(m)}
              className={`min-h-[36px] rounded-[9px] text-[13px] font-semibold ${mode === m ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted'}`}>
              {m === 'off' ? (fr ? 'Arrêt' : 'Off') : m === 'dry_run' ? 'Test' : (fr ? 'Réel' : 'Live')}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {mode === 'live'
            ? (fr ? 'Les messages partent aux voyageurs sur ces canaux :' : 'Messages go to guests on these channels:')
            : mode === 'dry_run'
              ? (fr ? 'Chaque message est écrit dans le journal. Rien n’est envoyé.' : 'Each message is written to the log. Nothing reaches guests.')
              : (fr ? 'Aucun message n’est préparé.' : 'No messages are prepared.')}
        </p>
        {mode === 'live' && (
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(ch => {
              const on = liveChannels.includes(ch);
              return (
                <button key={ch} aria-pressed={on} className={`chip ${on ? 'chip-on' : ''}`}
                  onClick={() => saveSettings('live', on ? liveChannels.filter(c => c !== ch) : [...liveChannels, ch])}>
                  {on && <CheckCircle2 size={16} aria-hidden />}{ch === 'Direct booking' ? 'Direct' : ch}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card overflow-hidden divide-y divide-line">
        {rules.length === 0 && <div className="p-4 text-sm text-muted">{mode === null ? (fr ? 'Chargement…' : 'Loading…') : (fr ? 'Aucun message configuré.' : 'No messages set up yet.')}</div>}
        {rules.map(t => {
          const Icon = RULE_ICONS[t.key] || MessageSquare;
          return (
            <div key={t.key} className="px-4 py-3.5 flex items-center gap-3">
              <span className={`tile ${t.active ? '' : 'bg-page text-muted'}`}><Icon size={20} strokeWidth={1.75} aria-hidden /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold">{label(t.key)}</div>
                <div className="text-[13px] text-muted mt-0.5">{timing(t, fr)}</div>
              </div>
              <Switch on={t.active} busy={busyKey === t.key} label={label(t.key)} onChange={v => toggleTemplate(t.key, v)} />
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{fr ? 'À venir, 7 jours' : 'Coming up, 7 days'}</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {planned === null && <div className="p-4 text-sm text-muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden />{fr ? 'Calcul…' : 'Working it out…'}</div>}
          {planned?.length === 0 && <div className="p-4 text-sm text-muted">{fr ? 'Aucun message prévu.' : 'No messages planned.'}</div>}
          {planned?.map(m => {
            const id = `${m.bookingId}:${m.templateKey}`;
            const expanded = open === id;
            return (
              <div key={id}>
                <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-page" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : id)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{label(m.templateKey)} · {m.guestName}</div>
                    <div className="text-[13px] text-muted mt-0.5 truncate">
                      {new Date(m.sendAt).toLocaleString(locale, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {m.channel}
                    </div>
                  </div>
                  <ChevronDown size={18} className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {expanded && <p className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-line">{m.body}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {replies.length > 0 && <QuickReply fr={fr} locale={locale} replies={replies} bookings={bookings} label={label} />}

      <section className="space-y-2">
        <h2 className="section-title">{fr ? 'Journal' : 'Log'}</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {log.length === 0 && <div className="p-4 text-sm text-muted">{fr ? 'Rien pour l’instant.' : 'Nothing yet.'}</div>}
          {log.map(r => {
            const sent = r.status === 'sent', failed = r.status === 'failed';
            return (
              <div key={`${r.smoobu_booking_id}:${r.template_key}:${r.mode}`} className="px-4 py-3 flex items-center gap-3">
                <span className={`pill ${sent ? 'bg-tint text-accent' : failed ? 'bg-danger-tint text-danger' : 'bg-info-tint text-info'}`}>
                  {sent ? <CheckCircle2 size={14} aria-hidden /> : failed ? <AlertCircle size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                  {sent ? (fr ? 'Envoyé' : 'Sent') : failed ? (fr ? 'Échec' : 'Failed') : 'Test'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{label(r.template_key)} · {r.guest_name}</div>
                  <div className="text-[13px] text-muted truncate" title={r.error || undefined}>
                    {new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {r.error ? ` · ${r.error}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function QuickReply({ fr, locale, replies, bookings, label }: {
  fr: boolean; locale: string; replies: Template[]; bookings: Booking[]; label: (k: string) => string;
}) {
  const today = new Date().toLocaleDateString('sv-SE');
  const soon = new Date(Date.now() + 14 * 86400000).toLocaleDateString('sv-SE');
  const options = useMemo(() => bookings
    .filter(b => !isBlock(b) && b.reference_id?.startsWith('smoobu-') && b.checkout_date >= today && b.checkin_date <= soon)
    .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date)), [bookings, today, soon]);

  const [bookingId, setBookingId] = useState('');
  const [key, setKey] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { if (!bookingId && options[0]) setBookingId(options[0].reference_id!.slice(7)); }, [options, bookingId]);

  const render = async (k: string) => {
    setKey(k); setState('loading'); setError('');
    const res = await apiFetch(`/messaging/reply/${bookingId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setText(d.body); setState('idle'); } else { setError(d.error || res.statusText); setState('error'); }
  };

  const send = async () => {
    const b = options.find(o => o.reference_id === `smoobu-${bookingId}`);
    if (!window.confirm(fr ? `Envoyer ce message à ${b?.guest_name} ?` : `Send this message to ${b?.guest_name}?`)) return;
    setState('sending');
    const res = await apiFetch(`/messaging/reply/${bookingId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, send: true }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.sent) setState('sent'); else { setError(d.error || (fr ? 'Envoi impossible.' : 'Could not send.')); setState('error'); }
  };

  return (
    <section className="space-y-2">
      <h2 className="section-title">{fr ? 'Réponses rapides' : 'Quick replies'}</h2>
      <div className="card p-4 space-y-3">
        <label className="block text-[13px] text-muted" htmlFor="qr-booking">{fr ? 'Voyageur' : 'Guest'}</label>
        <select id="qr-booking" value={bookingId} onChange={e => { setBookingId(e.target.value); setText(''); setKey(''); setState('idle'); }}
          className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 text-sm">
          {options.length === 0 && <option value="">{fr ? 'Aucun séjour dans les 14 jours' : 'No stay in the next 14 days'}</option>}
          {options.map(b => (
            <option key={b.id} value={b.reference_id!.slice(7)}>
              {b.guest_name} · {b.property_name} · {new Date(`${b.checkin_date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {replies.map(r => {
            const Icon = REPLY_ICONS[r.key] || MessageSquare;
            return (
              <button key={r.key} className={`chip ${key === r.key ? 'chip-on' : ''}`} disabled={!bookingId || state === 'loading'} onClick={() => render(r.key)}>
                <Icon size={16} aria-hidden />{label(r.key)}
              </button>
            );
          })}
        </div>
        {state === 'loading' && <p className="text-sm text-muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden />{fr ? 'Préparation…' : 'Preparing…'}</p>}
        {text && state !== 'loading' && (
          <>
            <textarea value={text} rows={6} readOnly
              className="w-full rounded-xl border border-line bg-page p-3 text-sm leading-relaxed" aria-label={fr ? 'Aperçu du message' : 'Message preview'} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">
                {state === 'sent' ? (fr ? 'Envoyé via Smoobu.' : 'Sent through Smoobu.') : (fr ? 'Rien n’est envoyé avant votre clic.' : 'Nothing is sent until you click.')}
              </span>
              <button className="btn-primary" onClick={send} disabled={state === 'sending' || state === 'sent'}>
                {state === 'sending' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : state === 'sent' ? <CheckCircle2 size={18} aria-hidden /> : <Send size={18} aria-hidden />}
                {state === 'sent' ? (fr ? 'Envoyé' : 'Sent') : (fr ? 'Envoyer' : 'Send')}
              </button>
            </div>
          </>
        )}
        {state === 'error' && <p className="text-sm text-danger flex items-center gap-2"><AlertCircle size={16} aria-hidden />{error}</p>}
      </div>
    </section>
  );
}
