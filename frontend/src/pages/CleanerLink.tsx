import { API_BASE } from '@/apiBase';
import Logo from '@/components/Logo';
import { AlertCircle, CheckCircle2, Clock, Loader2, MapPin, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Task {
  id: number;
  date: string;
  status: string;
  property: string;
  address: string | null;
  start: string;
  nextArrival: string | null;
  nextCheckIn: string | null;
  nextGuests: number | null;
}

interface ScheduleData { name: string; language: string; today: string; tasks: Task[] }

const fmtDate = (d: string, fr: boolean) =>
  new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${d}T12:00:00Z`));
const fmtTime = (t: string, fr: boolean) => (fr ? t.replace(/^0?(\d+):(\d\d)$/, (_, h, m) => `${h}h${m === '00' ? '' : m}`) : t);

/** Cleaner's schedule, opened from the WhatsApp link (/s/:token). No login. */
export default function CleanerLink() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/s/${token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  const fr = (data?.language || navigator.language || 'fr').startsWith('fr');

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="px-4 py-3 border-b border-line bg-surface">
        <div className="max-w-[640px] mx-auto"><Logo /></div>
      </header>
      <main className="max-w-[640px] mx-auto p-4 space-y-4">
        {error && (
          <div className="card p-5 flex items-center gap-3 text-danger">
            <AlertCircle size={20} aria-hidden />
            <p className="text-sm">{fr ? 'Ce lien ne fonctionne plus. Demandez-en un nouveau au propriétaire.' : 'This link no longer works. Ask the owner for a new one.'}</p>
          </div>
        )}
        {!data && !error && (
          <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>
        )}
        {data && <>
          <div>
            <h1 className="page-title">{fr ? `Bonjour ${data.name}` : `Hello ${data.name}`}</h1>
            <p className="text-sm text-muted">{fr ? 'Vos ménages des 30 prochains jours' : 'Your cleanings in the next 30 days'}</p>
          </div>
          {data.tasks.length === 0 && (
            <div className="card p-5 text-sm text-muted">{fr ? 'Aucun ménage prévu.' : 'No cleaning planned.'}</div>
          )}
          {data.tasks.map(t => {
            const sameDay = t.nextArrival === t.date;
            return (
              <article key={t.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold first-letter:uppercase">{t.date === data.today ? (fr ? 'Aujourd’hui' : 'Today') : fmtDate(t.date, fr)}</h2>
                  {t.status === 'done'
                    ? <span className="pill bg-tint text-accent"><CheckCircle2 size={14} aria-hidden />{fr ? 'Fait' : 'Done'}</span>
                    : sameDay && <span className="pill bg-warn-tint text-warn">{fr ? 'Arrivée le jour même' : 'Same-day arrival'}</span>}
                </div>
                <p className="text-sm font-semibold">{t.property}</p>
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
              </article>
            );
          })}
        </>}
      </main>
    </div>
  );
}
