import { apiFetch } from '@/api';
import { AuthImage, fmtClock, fmtDate, reportLabel, type VisitDetail } from '@/components/visit';
import { useApp } from '@/contexts/AppContext';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

/** Owner's view of one cleaning (mockup screen 7): when it finished, steps, photos, what was reported. */
export default function CleaningReport() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [d, setD] = useState<VisitDetail | null>(null);
  const [error, setError] = useState(false);

  const load = () => apiFetch(`/visit/tasks/${id}`).then(r => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setError(true));
  useEffect(() => { load(); }, [id]);

  const resolve = async (rid: number) => {
    await apiFetch(`/cleaning/reports/${rid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
    load();
  };

  if (error) return <div className="p-4"><div className="card p-5 text-sm text-danger">{fr ? 'Ménage introuvable.' : 'Cleaning not found.'}</div></div>;
  if (!d) return <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>;
  const t = d.task;
  const photos = d.rooms.flatMap(r => r.steps.filter(s => s.photoId).map(s => ({ id: s.photoId!, label: s.label })));

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="px-2 h-14 flex items-center gap-1 border-b border-line">
        <Link to="/cleaners" className="icon-btn" aria-label={fr ? 'Retour' : 'Back'}><ChevronLeft size={20} /></Link>
        <div className="min-w-0">
          <h1 className="font-semibold truncate">{fr ? 'Ménage' : 'Cleaning'} · {t.property}</h1>
          <p className="text-xs text-muted first-letter:uppercase">{fmtDate(t.date, fr)}{t.cleaner ? ` · ${t.cleaner}` : ''}</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card p-3 text-center">
            <p className="text-xs text-muted">{t.status === 'done' ? (fr ? 'Fini à' : 'Finished') : (fr ? 'Statut' : 'Status')}</p>
            <p className="text-lg font-semibold">{t.finishedAt ? fmtClock(t.finishedAt, fr) : t.startedAt ? (fr ? 'En cours' : 'Started') : (fr ? 'À faire' : 'To do')}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-muted">{fr ? 'Étapes' : 'Steps'}</p>
            <p className="text-lg font-semibold tabular-nums">{d.progress.done}/{d.progress.total}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-muted">Photos</p>
            <p className="text-lg font-semibold tabular-nums">{d.progress.photos}/{d.progress.photosNeeded}</p>
          </div>
        </div>

        {t.finishNote && <div className="card p-4 text-sm">« {t.finishNote} »</div>}

        <section className="card p-4 space-y-3">
          <h2 className="section-title">Photos</h2>
          {photos.length === 0
            ? <p className="text-sm text-muted">{fr ? 'Pas encore de photo.' : 'No photos yet.'}</p>
            : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map(p => (
                  <figure key={p.id} className="space-y-1">
                    <AuthImage id={p.id} alt={p.label} className="w-full aspect-square rounded-lg" />
                    <figcaption className="text-[11px] text-muted line-clamp-2">{p.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="section-title">{fr ? 'Signalé' : 'Reported'}</h2>
          {d.reports.length === 0 && <p className="text-sm text-muted">{fr ? 'Rien à signaler.' : 'Nothing reported.'}</p>}
          {d.reports.map(r => (
            <div key={r.id} className="flex items-start gap-3">
              {r.photoId && <AuthImage id={r.photoId} alt={r.what} className="w-16 h-16 rounded-lg shrink-0" />}
              <div className="flex-1 min-w-0 space-y-1">
                <span className="pill bg-warn-tint text-warn">{reportLabel(r.type, fr)}</span>
                <p className="text-sm font-semibold">{r.what}</p>
                {r.note && <p className="text-sm text-muted">{r.note}</p>}
              </div>
              {r.status === 'open'
                ? <button className="btn-secondary text-sm shrink-0" onClick={() => resolve(r.id)}>{fr ? 'C’est réglé' : 'Resolved'}</button>
                : <span className="pill bg-tint text-accent shrink-0">{fr ? 'Réglé' : 'Resolved'}</span>}
            </div>
          ))}
        </section>

        <section className="card overflow-hidden">
          <h2 className="section-title px-4 pt-4 pb-2">{fr ? 'Liste' : 'Checklist'}</h2>
          {d.rooms.map(room => (
            <div key={room.room} className="px-4 py-2 border-t border-line">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide py-1">{room.room}</p>
              {room.steps.map(s => (
                <p key={s.id} className={`text-sm py-1 ${s.done ? '' : 'text-muted line-through decoration-transparent'}`}>
                  {s.done ? '✓' : '○'} {s.label}
                </p>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
