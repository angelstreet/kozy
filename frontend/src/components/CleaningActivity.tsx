import { apiFetch } from '@/api';
import { AuthImage, fmtDate, reportLabel } from '@/components/visit';
import { useApp } from '@/contexts/AppContext';
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Clock, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Activity {
  today: string;
  recent: { id: number; date: string; status: string; startedAt: string | null; finishedAt: string | null; property: string; cleaner: string | null; reports: number }[];
  reports: { id: number; type: string; what: string; note: string | null; photoId: number | null; taskId: number | null; property: string; cleaner: string | null }[];
  shopping: { property: string; item: string; level: string }[];
}

/** Cleaners screen, owner side: open reports, the shopping list from stock, recent cleanings with their report. */
export default function CleaningActivity() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [a, setA] = useState<Activity | null>(null);
  const load = () => apiFetch('/cleaning/activity').then(r => (r.ok ? r.json() : null)).then(setA).catch(() => {});
  useEffect(() => { load(); }, []);

  const resolve = async (id: number) => {
    await apiFetch(`/cleaning/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
    load();
  };

  if (!a) return null;
  const byProperty = a.shopping.reduce<Record<string, typeof a.shopping>>((m, s) => ({ ...m, [s.property]: [...(m[s.property] || []), s] }), {});

  return (
    <section className="space-y-3 mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{fr ? 'Ménages' : 'Cleanings'}</h2>
        <Link to="/checklist" className="btn-secondary text-sm min-h-[40px]"><ClipboardList size={16} aria-hidden />{fr ? 'Liste de ménage' : 'Checklist'}</Link>
      </div>

      {a.reports.length > 0 && (
        <div className="card divide-y divide-line">
          {a.reports.map(r => (
            <div key={r.id} className="p-4 flex items-start gap-3">
              {r.photoId
                ? <AuthImage id={r.photoId} alt={r.what} className="w-14 h-14 rounded-lg shrink-0" />
                : <span className="w-10 h-10 rounded-full bg-warn-tint text-warn flex items-center justify-center shrink-0"><AlertTriangle size={18} /></span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{reportLabel(r.type, fr)} · {r.what}</p>
                <p className="text-xs text-muted truncate">{r.property}{r.cleaner ? ` · ${r.cleaner}` : ''}{r.note ? ` · ${r.note}` : ''}</p>
              </div>
              <button className="btn-secondary text-sm shrink-0" onClick={() => resolve(r.id)}>{fr ? 'Réglé' : 'Resolved'}</button>
            </div>
          ))}
        </div>
      )}

      {a.shopping.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2"><ShoppingCart size={16} aria-hidden />{fr ? 'Courses' : 'Shopping'}</p>
          {Object.entries(byProperty).map(([prop, items]) => (
            <p key={prop} className="text-sm"><span className="text-muted">{prop} : </span>
              {items.map(i => `${i.item} (${i.level === 'out' ? (fr ? 'vide' : 'out') : (fr ? 'bas' : 'low')})`).join(' · ')}
            </p>
          ))}
        </div>
      )}

      <div className="card divide-y divide-line">
        {a.recent.length === 0 && <p className="p-4 text-sm text-muted">{fr ? 'Aucun ménage récent.' : 'No recent cleaning.'}</p>}
        {a.recent.map(t => {
          const done = t.status === 'done';
          return (
            <Link key={t.id} to={`/cleaning/${t.id}`} className="px-4 py-3 flex items-center gap-3 hover:bg-page">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-tint text-accent' : 'bg-page text-muted'}`}>
                {done ? <CheckCircle2 size={18} /> : <Clock size={18} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate first-letter:uppercase">{t.date === a.today ? (fr ? 'Aujourd’hui' : 'Today') : fmtDate(t.date, fr)} · {t.property}</p>
                <p className="text-xs text-muted">{t.cleaner || '—'} · {done ? (fr ? 'fait' : 'done') : t.startedAt ? (fr ? 'en cours' : 'in progress') : (fr ? 'pas commencé' : 'not started')}
                  {t.reports > 0 ? ` · ${t.reports} ${fr ? 'signalement(s)' : 'report(s)'}` : ''}</p>
              </div>
              <ChevronRight size={16} className="text-muted" aria-hidden />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
