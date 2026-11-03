import { apiFetch } from '@/api';
import { AuthImage, PhotoButton, REPORT_TYPES } from '@/components/visit';
import { useApp } from '@/contexts/AppContext';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

/** Report a problem (mockup screen 4): missing, broken, product to buy, guest damage, with a photo. */
export default function Report() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const taskId = params.get('task') ? Number(params.get('task')) : null;
  const [properties, setProperties] = useState<{ id: number; label: string }[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(params.get('property') ? Number(params.get('property')) : null);
  const [type, setType] = useState('missing');
  const [what, setWhat] = useState('');
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/visit/stock').then(r => r.json()).then(d => {
      const ps = (d.properties || []).map((p: any) => ({ id: p.id, label: p.label }));
      setProperties(ps);
      if (!propertyId && ps.length) setPropertyId(ps[0].id);
    }).catch(() => {});
  }, []);

  const back = taskId ? `/c/task/${taskId}` : '/c/schedule';

  const send = async () => {
    if (!propertyId || !what.trim()) { setError(fr ? 'Dites ce qui ne va pas.' : 'Say what is wrong.'); return; }
    setState('busy'); setError('');
    const res = await apiFetch('/visit/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, taskId, type, what: what.trim(), note: note.trim() || undefined, photoId }),
    });
    if (res.ok) { setState('sent'); setTimeout(() => navigate(back), 1200); }
    else { setState('idle'); setError((await res.json().catch(() => ({}))).error || 'Error'); }
  };

  if (state === 'sent') {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-center">
        <span className="w-14 h-14 rounded-full bg-tint text-accent flex items-center justify-center"><CheckCircle2 size={28} /></span>
        <p className="font-semibold">{fr ? 'Envoyé. Le propriétaire est prévenu.' : 'Sent. The owner has been told.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="px-2 h-14 flex items-center gap-1 border-b border-line">
        <Link to={back} className="icon-btn" aria-label={fr ? 'Fermer' : 'Close'}><X size={20} /></Link>
        <h1 className="font-semibold">{fr ? 'Signaler' : 'Report'}</h1>
      </div>
      <div className="p-4 space-y-5">
        {properties.length > 1 && !taskId && (
          <div className="grid gap-1 p-1 rounded-xl bg-surface border border-line" style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(0, 1fr))` }} role="group" aria-label={fr ? 'Logement' : 'Property'}>
            {properties.map(p => (
              <button key={p.id} aria-pressed={propertyId === p.id} onClick={() => setPropertyId(p.id)}
                className={`min-h-[40px] rounded-[9px] text-sm font-semibold ${propertyId === p.id ? 'bg-tint text-accent' : 'text-muted'}`}>{p.label}</button>
            ))}
          </div>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-semibold mb-2.5">{fr ? 'Quel problème ?' : 'What kind of problem?'}</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {REPORT_TYPES.map(t => {
              const [label, hint] = fr ? t.fr : t.en;
              const on = type === t.id;
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => setType(t.id)}
                  className={`min-h-[64px] rounded-xl px-3 py-2.5 text-left bg-surface ${on ? 'border-2 border-accent bg-tint' : 'border border-line'}`}>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="what" className="text-sm font-semibold">{fr ? 'Quoi ?' : 'What?'}</label>
          <input id="what" value={what} onChange={e => setWhat(e.target.value)} placeholder={fr ? 'Ex. : serviettes de bain' : 'E.g. bath towels'}
            className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rnote" className="text-sm font-semibold">{fr ? 'Précision' : 'Details'} <span className="font-normal text-muted">{fr ? '(facultatif)' : '(optional)'}</span></label>
          <textarea id="rnote" rows={2} value={note} onChange={e => setNote(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div className="flex items-center gap-3">
          {photoId && <AuthImage id={photoId} alt={fr ? 'Photo jointe' : 'Attached photo'} className="w-20 h-20 rounded-xl" />}
          {propertyId && (
            <PhotoButton propertyId={propertyId} taskId={taskId} onUploaded={setPhotoId} className="btn-secondary text-sm"
              label={photoId ? (fr ? 'Changer la photo' : 'Change photo') : (fr ? 'Ajouter une photo' : 'Add a photo')} />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="pt-2 space-y-2">
          <button onClick={send} disabled={state === 'busy'} className="btn-primary w-full min-h-[48px]">
            {state === 'busy' && <Loader2 size={18} className="animate-spin" />}{fr ? 'Envoyer' : 'Send'}
          </button>
          <p className="text-xs text-muted text-center">{fr ? 'Le propriétaire est prévenu tout de suite.' : 'The owner is told straight away.'}</p>
        </div>
      </div>
    </div>
  );
}
