import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, LogIn, LogOut, MessageSquare, PauseCircle, Send, type LucideIcon } from 'lucide-react';
import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { useProperties } from '@/hooks/useProperties';
import EmptyState from '@/components/EmptyState';
import { cleanGuestName } from '@/components/owner/bookingActivityUtils';

interface Booking {
  id: number;
  property_id: number;
  property_name: string;
  checkin_date: string;
  checkout_date: string;
  checkin_time?: string | null;
  checkout_time?: string | null;
  guest_name: string;
  channel_name?: string | null;
  source?: string | null;
  price?: number | null;
  adults?: number | null;
  children?: number | null;
}

interface PlannedMessage { bookingId: number; templateKey: string; guestName: string; sendAt: string; due: boolean }
interface MessagingPreview { settings: { mode: 'off' | 'dry_run' | 'live' }; messages: PlannedMessage[] }

/** Local calendar date as YYYY-MM-DD. */
const ymd = (d: Date) => d.toLocaleDateString('sv-SE');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nights = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Owner blocks: direct bookings without a price. */
export const isBlock = (b: Pick<Booking, "channel_name" | "source" | "price">) => (b.channel_name || b.source || '').toLowerCase().includes('direct') && !b.price;

export const TEMPLATE_LABELS: Record<string, [string, string]> = {
  confirmation: ['Welcome', 'Bienvenue'],
  pre_arrival: ['Before arrival', 'Avant l’arrivée'],
  checkin: ['Arrival day', 'Jour d’arrivée'],
  checkout_reminder: ['Check-out reminder', 'Rappel de départ'],
  checkout_day: ['Check-out day', 'Jour de départ'],
  review: ['Review request', 'Demande d’avis'],
};

function shortName(name: string) {
  const parts = cleanGuestName(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '—';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xs text-muted truncate" title={label}>{label}</div>
      <div className={`text-xl font-semibold mt-1 tabular-nums ${tone || ''}`}>{value}</div>
    </div>
  );
}

function EventRow({ icon: Icon, warn, title, detail, badge }: { icon: LucideIcon; warn?: boolean; title: string; detail: string; badge?: React.ReactNode }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`tile ${warn ? 'bg-warn-tint text-warn' : ''}`}><Icon size={20} strokeWidth={1.75} aria-hidden /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold truncate">{title}</div>
        <div className="text-[13px] text-muted mt-0.5 truncate">{detail}</div>
      </div>
      {badge}
    </div>
  );
}

export default function Dashboard() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const locale = fr ? 'fr-FR' : 'en-GB';
  const { properties, loading, isEmpty } = useProperties();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [preview, setPreview] = useState<MessagingPreview | null | 'error'>(null);

  useEffect(() => {
    if (isEmpty || loading) return;
    apiFetch('/bookings').then(r => r.json()).then(d => setBookings(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch('/messaging/preview?days=3').then(r => (r.ok ? r.json() : 'error')).then(setPreview).catch(() => setPreview('error'));
  }, [isEmpty, loading]);

  const now = new Date();
  const today = ymd(now);

  const view = useMemo(() => {
    const guests = bookings.filter(b => !isBlock(b));
    const arrivals = guests.filter(b => b.checkin_date === today);
    const departures = guests.filter(b => b.checkout_date === today);
    const in30 = ymd(addDays(now, 30));
    const in7 = ymd(addDays(now, 7));
    let booked = 0;
    for (const b of guests) {
      const s = b.checkin_date > today ? b.checkin_date : today;
      const e = b.checkout_date < in30 ? b.checkout_date : in30;
      if (e > s) booked += nights(s, e);
    }
    const month = today.slice(0, 7);
    const revenue = guests.filter(b => b.checkin_date.startsWith(month)).reduce((sum, b) => sum + (Number(b.price) || 0), 0);
    const weekArrivals = guests.filter(b => b.checkin_date > today && b.checkin_date <= in7).length;
    const upcoming = guests
      .flatMap(b => [
        { b, kind: 'in' as const, date: b.checkin_date },
        { b, kind: 'out' as const, date: b.checkout_date },
      ])
      .filter(e => e.date > today)
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(0, 3);
    return {
      arrivals, departures, upcoming, weekArrivals, revenue,
      occupancy: properties.length ? Math.round((booked / (properties.length * 30)) * 100) : 0,
      byProperty: properties.map(p => {
        const mine = guests.filter(b => b.property_id === p.id);
        const current = mine.find(b => b.checkin_date <= today && b.checkout_date > today);
        const next = mine.filter(b => b.checkin_date > today).sort((x, y) => x.checkin_date.localeCompare(y.checkin_date))[0];
        return { p, current, next };
      }),
    };
  }, [bookings, properties, today]);

  if (loading) {
    return (
      <div className="p-4 space-y-4" aria-busy="true">
        <div className="h-8 w-40 rounded-lg bg-line/60" />
        <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(i => <div key={i} className="card h-[72px]" />)}</div>
        {[0, 1].map(i => <div key={i} className="card h-[76px]" />)}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        emoji="🏠"
        title={fr ? 'Bienvenue sur Kozy' : 'Welcome to Kozy'}
        subtitle={fr ? 'Ajoutez un logement ou connectez Smoobu dans Plus.' : 'Add a property, or connect Smoobu in More.'}
        ctaLabel={fr ? 'Ajouter un logement' : 'Add a property'}
        ctaTo="/add-property"
      />
    );
  }

  const dateLabel = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const plural = (n: number, en: string, frw: string) => `${n} ${fr ? frw : en}${n === 1 ? '' : 's'}`;
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  const guestsLabel = (b: Booking) => plural((b.adults || 0) + (b.children || 0) || 1, 'guest', 'voyageur');
  const money = (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const timeLabel = (t: string | null | undefined, fallback: string) => {
    const [h, m] = (t || fallback).split(':');
    return fr ? `${Number(h)}h${m && m !== '00' ? m : ''}` : `${h}:${m}`;
  };

  const ready = preview && preview !== 'error' ? preview : null;
  const mode = ready?.settings.mode;
  const next = ready?.messages?.[0];
  const modeBadge = mode === 'live'
    ? <span className="pill bg-tint text-accent"><Send size={14} aria-hidden />{fr ? 'Actif' : 'Live'}</span>
    : mode === 'dry_run'
      ? <span className="pill bg-info-tint text-info"><Eye size={14} aria-hidden />{fr ? 'Mode test' : 'Test mode'}</span>
      : <span className="pill bg-page text-muted"><PauseCircle size={14} aria-hidden />{fr ? 'Arrêté' : 'Off'}</span>;

  return (
    <div className="px-4 lg:px-8 pt-2 pb-6 space-y-5">
      <div>
        <h1 className="page-title">{fr ? 'Aujourd’hui' : 'Today'}</h1>
        <p className="text-sm text-muted mt-1 first-letter:uppercase">
          {dateLabel} · {plural(view.arrivals.length, 'arrival', 'arrivée')}, {plural(view.departures.length, 'departure', 'départ')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label={fr ? 'Occupation' : 'Occupancy'} value={`${view.occupancy} %`} />
        <Kpi label={fr ? 'Ce mois-ci' : 'This month'} value={money(view.revenue)} />
        <Kpi label={fr ? 'Arrivées 7 j' : 'Arrivals, 7 d'} value={String(view.weekArrivals)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="space-y-2">
          <h2 className="section-title">{fr ? 'Arrivées et départs' : 'Arrivals and departures'}</h2>
          {view.arrivals.map(b => (
            <EventRow key={`in-${b.id}`} icon={LogIn} title={`${shortName(b.guest_name)} · ${guestsLabel(b)}`}
              detail={`${b.property_name} · ${fr ? 'arrive' : 'arrives'} ${timeLabel(b.checkin_time, '16:00')} · ${plural(nights(b.checkin_date, b.checkout_date), 'night', 'nuit')}`} />
          ))}
          {view.departures.map(b => (
            <EventRow key={`out-${b.id}`} icon={LogOut} warn title={`${shortName(b.guest_name)} · ${fr ? 'part à' : 'leaves'} ${timeLabel(b.checkout_time, '12:00')}`}
              detail={`${b.property_name} · ${fr ? 'ménage à prévoir' : 'turnover today'}`} />
          ))}
          {view.arrivals.length + view.departures.length === 0 && (
            <>
              <p className="text-sm text-muted">{view.upcoming.length
                ? (fr ? 'Rien aujourd’hui. Prochainement :' : 'Nothing today. Coming up:')
                : (fr ? 'Aucune réservation à venir.' : 'No upcoming bookings.')}</p>
              {view.upcoming.map(({ b, kind, date }) => (
                <EventRow key={`${kind}-${b.id}`} icon={kind === 'in' ? LogIn : LogOut} warn={kind === 'out'}
                  title={`${shortName(b.guest_name)} · ${kind === 'in' ? (fr ? 'arrivée' : 'arrives') : (fr ? 'départ' : 'leaves')}`}
                  detail={`${b.property_name} · ${short(date)}`} />
              ))}
            </>
          )}
        </section>

        <div className="space-y-5">
          <section className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title">{fr ? 'Messages automatiques' : 'Automatic messages'}</h2>
              {ready && modeBadge}
            </div>
            <div className="flex items-center gap-3">
              <span className="tile"><MessageSquare size={20} strokeWidth={1.75} aria-hidden /></span>
              <div className="flex-1 min-w-0">
                {next ? (
                  <>
                    <div className="text-sm font-semibold truncate">{fr ? 'Prochain : ' : 'Next: '}{(TEMPLATE_LABELS[next.templateKey] || [next.templateKey, next.templateKey])[fr ? 1 : 0]}</div>
                    <div className="text-[13px] text-muted mt-0.5 truncate">
                      {shortName(next.guestName)} · {new Date(next.sendAt).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted">{preview === 'error'
                    ? (fr ? 'Connectez Smoobu dans Plus pour activer les messages.' : 'Connect Smoobu in More to turn messages on.')
                    : ready ? (fr ? 'Aucun message dans les 3 jours.' : 'No message in the next 3 days.') : (fr ? 'Chargement…' : 'Loading…')}</div>
                )}
              </div>
            </div>
            <Link to="/messages" className="min-h-[44px] flex items-center text-sm font-semibold text-accent">
              {fr ? 'Voir les messages' : 'Review messages'}
            </Link>
          </section>

          <section className="space-y-2">
            <h2 className="section-title">{fr ? 'Logements' : 'Properties'}</h2>
            <div className="card divide-y divide-line">
              {view.byProperty.map(({ p, current, next: nb }) => (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: p.color }} aria-hidden />
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{p.name}</span>
                  {current ? (
                    <span className="pill bg-tint text-accent"><CheckCircle2 size={14} aria-hidden />{fr ? 'Occupé' : 'Occupied'} · {short(current.checkout_date)}</span>
                  ) : (
                    <span className="pill bg-page text-muted"><Clock size={14} aria-hidden />{fr ? 'Libre' : 'Free'}{nb ? ` · ${short(nb.checkin_date)}` : ''}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
