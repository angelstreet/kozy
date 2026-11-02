import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { CheckCircle2, Circle, Clock, Loader2, MapPin, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Task {
  id: number;
  date: string;
  status: string;
  property: string;
  label: string;
  address: string | null;
  start: string;
  nextArrival: string | null;
  nextCheckIn: string | null;
  nextGuests: number | null;
}

interface Planning { name: string; today: string; counter: string | null; tasks: Task[] }

const fmtDate = (d: string, fr: boolean) =>
  new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${d}T12:00:00Z`));
const fmtTime = (t: string, fr: boolean) => (fr ? t.replace(/^0?(\d+):(\d\d)$/, (_, h, m) => `${h}h${m === '00' ? '' : m}`) : t);

/** Cleaner home: her cleanings (last week to 30 days ahead), pack counter, mark a cleaning done. */
export default function Schedule() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [data, setData] = useState<Planning | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => apiFetch('/cleaner/planning')
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(setData)
    .catch(() => setError(true));
  useEffect(() => { load(); }, []);

  const toggleDone = async (t: Task) => {
    setBusy(t.id);
    const res = await apiFetch(`/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: t.status === 'done' ? 'pending' : 'done' }),
    });
    if (res.ok) await load();
    setBusy(null);
  };

  if (error) return <div className="p-4"><div className="card p-5 text-sm text-danger">{fr ? 'Impossible de charger votre planning.' : 'Could not load your planning.'}</div></div>;
  if (!data) return <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>;

  const upcoming = data.tasks.filter(t => t.date >= data.today);
  const past = data.tasks.filter(t => t.date < data.today).reverse();

  const card = (t: Task) => {
    const sameDay = t.nextArrival === t.date;
    const done = t.status === 'done';
    return (
      <article key={t.id} className={`card p-4 space-y-2 ${done ? 'opacity-70' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold first-letter:uppercase">{t.date === data.today ? (fr ? 'Aujourd’hui' : 'Today') : fmtDate(t.date, fr)}</h2>
          {sameDay && !done && <span className="pill bg-warn-tint text-warn">{fr ? 'Arrivée le jour même' : 'Same-day arrival'}</span>}
        </div>
        <p className="text-sm font-semibold">{t.label}</p>
        {t.address && (
          <a className="text-sm text-accent flex items-center gap-1.5 underline-offset-2 hover:underline" target="_blank" rel="noreferrer"
            href={`https://maps.google.com/?q=${encodeURIComponent(t.address)}`}>
            <MapPin size={14} aria-hidden />{t.address}
          </a>
        )}
        <p className="text-sm text-muted flex items-center gap-1.5">
          <Clock size={14} aria-hidden />
          {fr ? 'À partir de' : 'From'} {fmtTime(t.start, fr)}
          {t.nextArrival
            ? <> · {fr ? 'avant' : 'before'} {sameDay ? '' : `${fmtDate(t.nextArrival, fr)} `}{fmtTime(t.nextCheckIn || '16:00', fr)}</>
            : <> · {fr ? 'pas d’arrivée prévue' : 'no arrival planned'}</>}
        </p>
        {!!t.nextGuests && (
          <p className="text-sm text-muted flex items-center gap-1.5">
            <Users size={14} aria-hidden />{fr ? `${t.nextGuests} pers. ensuite` : `${t.nextGuests} guests next`}
          </p>
        )}
        {t.date <= data.today && (
          <button onClick={() => toggleDone(t)} disabled={busy === t.id} aria-pressed={done}
            className={`mt-1 w-full min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2 ${done ? 'btn-secondary' : 'btn-primary'}`}>
            {busy === t.id ? <Loader2 size={18} className="animate-spin" /> : done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            {done ? (fr ? 'Fait' : 'Done') : (fr ? 'Marquer comme fait' : 'Mark as done')}
          </button>
        )}
      </article>
    );
  };

  return (
    <div className="p-4 space-y-4 max-w-[640px] mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{fr ? `Bonjour ${data.name}` : `Hello ${data.name}`}</h1>
          <p className="text-sm text-muted">{fr ? 'Vos ménages des 30 prochains jours' : 'Your cleanings in the next 30 days'}</p>
        </div>
        {data.counter && (
          <div className="text-right" title={fr ? 'Ménages faits / payés' : 'Cleanings done / paid'}>
            <p className="text-xs text-muted">{fr ? 'Forfait' : 'Pack'}</p>
            <p className="text-lg font-semibold tabular-nums">{data.counter}</p>
          </div>
        )}
      </div>
      {upcoming.length === 0 && <div className="card p-5 text-sm text-muted">{fr ? 'Aucun ménage prévu.' : 'No cleaning planned.'}</div>}
      {upcoming.map(card)}
      {past.length > 0 && <>
        <h2 className="section-title pt-2">{fr ? 'Cette semaine passée' : 'Past week'}</h2>
        {past.map(card)}
      </>}
    </div>
  );
}
