import { apiFetch } from '@/api';
import { AuthImage, PhotoButton, fmtClock, fmtDate, fmtTime, reportLabel, type Step, type VisitDetail } from '@/components/visit';
import { useApp } from '@/contexts/AppContext';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

/** A cleaning in progress (mockup screens 2, 3 and 5): checklist by room, photo steps, reports, finish. */
export default function Task() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [d, setD] = useState<VisitDetail | null>(null);
  const [error, setError] = useState('');
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    apiFetch(`/visit/tasks/${id}`).then(r => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setError('load'));
  }, [id]);

  const save = async (s: Step, done: boolean, photoId?: number) => {
    const res = await apiFetch(`/visit/tasks/${id}/steps/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done, photoId }),
    });
    if (res.ok) setD(await res.json());
  };

  const finish = async () => {
    setFinishing(true);
    const res = await apiFetch(`/visit/tasks/${id}/finish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note || undefined }),
    });
    if (res.ok) setD(await res.json());
    setFinishing(false);
  };

  if (error) return <div className="p-4"><div className="card p-5 text-sm text-danger">{fr ? 'Ménage introuvable.' : 'Cleaning not found.'}</div></div>;
  if (!d) return <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>;

  const t = d.task;
  const done = t.status === 'done';
  const sameDay = t.nextArrival === t.date;
  const pct = d.progress.total ? Math.round((d.progress.done / d.progress.total) * 100) : 0;
  const missingPhotos = d.progress.photosNeeded - d.progress.photos;

  return (
    <div className="max-w-[640px] mx-auto pb-8">
      <div className="sticky top-14 lg:top-16 z-20 bg-page border-b border-line">
        <div className="px-2 h-14 flex items-center gap-1">
          <Link to="/c/schedule" className="icon-btn" aria-label={fr ? 'Retour au planning' : 'Back to planning'}><ChevronLeft size={20} /></Link>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{t.label}{done ? (fr ? ' · fait' : ' · done') : ''}</p>
            <p className="text-xs text-muted truncate first-letter:uppercase">
              {fmtDate(t.date, fr)} · {t.nextArrival
                ? `${fr ? 'avant' : 'before'} ${sameDay ? '' : `${fmtDate(t.nextArrival, fr)} `}${fmtTime(t.nextCheckIn || '16:00', fr)}`
                : (fr ? 'pas d’arrivée prévue' : 'no arrival planned')}
              {t.nextGuests ? ` · ${t.nextGuests} ${fr ? 'pers.' : 'guests'}` : ''}
            </p>
          </div>
          <Link to={`/c/report?property=${t.propertyId}&task=${t.id}`} className="icon-btn text-warn" aria-label={fr ? 'Signaler un problème' : 'Report a problem'} title={fr ? 'Signaler' : 'Report'}>
            <AlertTriangle size={20} />
          </Link>
        </div>
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">{d.progress.done} / {d.progress.total} {fr ? 'étapes' : 'steps'}</span>
            <span className="text-muted">{d.progress.photos} / {d.progress.photosNeeded} photos</span>
          </div>
          <div className="h-2 rounded bg-line overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {d.rooms.map(room => (
          <section key={room.room} className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-line">
              <h2 className="section-title">{room.room}</h2>
              <span className="text-xs text-muted tabular-nums">{room.steps.filter(s => s.done).length} / {room.steps.length}</span>
            </div>
            {room.steps.map(s => (
              <div key={s.id} className="border-b border-line last:border-0">
                <div className="min-h-[52px] px-4 flex items-center gap-3">
                  <input type="checkbox" checked={s.done} disabled={done} onChange={e => save(s, e.target.checked)}
                    aria-label={s.label} className="w-5 h-5 accent-[rgb(var(--accent))] shrink-0" />
                  <span className={`flex-1 text-sm ${s.done ? 'text-muted' : ''}`}>{s.label}</span>
                  {s.needsPhoto && (
                    <button type="button" onClick={() => setOpenStep(openStep === s.id ? null : s.id)} aria-expanded={openStep === s.id}
                      className={`pill ${s.photoId ? 'bg-tint text-accent' : 'bg-warn-tint text-warn'}`}>
                      <Camera size={13} aria-hidden />{s.photoId ? (fr ? 'Photo prise' : 'Photo taken') : 'Photo'}
                    </button>
                  )}
                </div>
                {openStep === s.id && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                    <figure className="space-y-1">
                      {s.refPhotoId
                        ? <AuthImage id={s.refPhotoId} alt={fr ? 'Photo de référence' : 'Reference photo'} className="w-full h-36 rounded-xl" />
                        : <div className="h-36 rounded-xl bg-page border border-line flex items-center justify-center text-xs text-muted text-center px-2">{fr ? 'Pas de photo de référence' : 'No reference photo'}</div>}
                      <figcaption className="text-xs text-muted">{fr ? 'Comme ça' : 'Like this'}</figcaption>
                    </figure>
                    <figure className="space-y-1">
                      {s.photoId
                        ? <AuthImage id={s.photoId} alt={fr ? 'Votre photo' : 'Your photo'} className="w-full h-36 rounded-xl" />
                        : <div className="h-36 rounded-xl border-2 border-dashed border-line flex items-center justify-center text-muted"><Camera size={28} aria-hidden /></div>}
                      {!done && (
                        <PhotoButton propertyId={t.propertyId} taskId={t.id} label={s.photoId ? (fr ? 'Reprendre' : 'Retake') : (fr ? 'Prendre la photo' : 'Take photo')}
                          className="btn-secondary w-full text-sm px-2 gap-1.5 whitespace-nowrap" onUploaded={pid => save(s, true, pid)} />
                      )}
                    </figure>
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}

        {d.reports.length > 0 && (
          <section className="card p-4 space-y-2">
            <h2 className="section-title">{fr ? 'Signalé' : 'Reported'}</h2>
            {d.reports.map(r => (
              <div key={r.id} className="flex items-start gap-2 text-sm">
                <span className="pill bg-warn-tint text-warn">{reportLabel(r.type, fr)}</span>
                <span className="flex-1">{r.what}{r.note ? <span className="text-muted"> · {r.note}</span> : null}</span>
              </div>
            ))}
          </section>
        )}

        {done ? (
          <section className="card p-5 text-center space-y-2">
            <span className="mx-auto w-14 h-14 rounded-full bg-tint text-accent flex items-center justify-center"><CheckCircle2 size={28} /></span>
            <h2 className="text-lg font-semibold">{fr ? 'Ménage terminé' : 'Cleaning finished'}</h2>
            {t.finishedAt && <p className="text-sm text-muted">{fr ? 'Fini à' : 'Finished at'} {fmtClock(t.finishedAt, fr)}</p>}
            {t.finishNote && <p className="text-sm">« {t.finishNote} »</p>}
          </section>
        ) : (
          <section className="card p-4 space-y-3">
            <h2 className="section-title">{fr ? 'Terminer' : 'Finish'}</h2>
            {(d.progress.done < d.progress.total || missingPhotos > 0) && (
              <p className="text-sm text-warn">
                {fr
                  ? `Il reste ${d.progress.total - d.progress.done} étape(s)${missingPhotos > 0 ? ` et ${missingPhotos} photo(s)` : ''}.`
                  : `${d.progress.total - d.progress.done} step(s)${missingPhotos > 0 ? ` and ${missingPhotos} photo(s)` : ''} left.`}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="note" className="text-sm font-semibold">{fr ? 'Un mot pour le propriétaire' : 'A note for the owner'} <span className="font-normal text-muted">{fr ? '(facultatif)' : '(optional)'}</span></label>
              <textarea id="note" rows={2} value={note} onChange={e => setNote(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <button onClick={finish} disabled={finishing} className="btn-primary w-full min-h-[48px]">
              {finishing && <Loader2 size={18} className="animate-spin" />}{fr ? 'Valider la fin du ménage' : 'Confirm cleaning finished'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
