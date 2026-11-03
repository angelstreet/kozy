import { apiFetch } from '@/api';
import { AuthImage, PhotoButton } from '@/components/visit';
import { useApp } from '@/contexts/AppContext';
import { useProperties } from '@/hooks/useProperties';
import { ArrowDown, ArrowUp, Camera, ChevronLeft, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Step { id: number; room: string; label: string; needsPhoto: boolean; refPhotoId: number | null; position: number }

const call = (path: string, method: string, body?: unknown) =>
  apiFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

/** Owner: the cleaning checklist (rooms → steps, photo steps, reference photos) and stock list of each property. */
export default function ChecklistEditor() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const { properties } = useProperties();
  const [pid, setPid] = useState<number | null>(null);
  const [tab, setTab] = useState<'steps' | 'stock'>('steps');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [stock, setStock] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newRoom, setNewRoom] = useState('');

  useEffect(() => { if (!pid && properties.length) setPid(properties[0].id); }, [properties]);
  const load = async () => {
    if (!pid) return;
    const r = await apiFetch(`/checklist/${pid}`);
    if (r.ok) { const d = await r.json(); setSteps(d.steps); setStock(d.stock); }
  };
  useEffect(() => { setSteps(null); load(); }, [pid]);

  const rooms = (steps || []).reduce<{ room: string; steps: Step[] }[]>((acc, s) => {
    const r = acc.find(x => x.room === s.room);
    if (r) r.steps.push(s); else acc.push({ room: s.room, steps: [s] });
    return acc;
  }, []);

  const patch = async (s: Step, change: Partial<Step>) => {
    setSteps(ss => ss!.map(x => (x.id === s.id ? { ...x, ...change } : x)));
    await call(`/checklist/steps/${s.id}`, 'PATCH', change);
  };
  const remove = async (s: Step) => {
    if (!confirm(fr ? `Supprimer « ${s.label} » ?` : `Delete “${s.label}”?`)) return;
    await call(`/checklist/steps/${s.id}`, 'DELETE');
    load();
  };
  const add = async (room: string) => {
    const label = prompt(fr ? `Nouvelle étape dans ${room}` : `New step in ${room}`);
    if (!label?.trim()) return;
    await call(`/checklist/${pid}/steps`, 'POST', { room, label });
    load();
  };
  const addRoom = async () => {
    if (!newRoom.trim()) return;
    const label = prompt(fr ? `Première étape dans ${newRoom}` : `First step in ${newRoom}`);
    if (!label?.trim()) return;
    await call(`/checklist/${pid}/steps`, 'POST', { room: newRoom.trim(), label });
    setNewRoom('');
    load();
  };
  const renameRoom = async (from: string, to: string) => {
    if (!to.trim() || to === from) return;
    await call(`/checklist/${pid}/rooms`, 'PUT', { from, to });
    load();
  };
  /** Move a step up/down inside its room, or a whole room up/down. */
  const reorder = async (ordered: Step[]) => {
    setSteps(ordered.map((s, i) => ({ ...s, position: i })));
    await call(`/checklist/${pid}/order`, 'PUT', { ids: ordered.map(s => s.id) });
  };
  const moveStep = (s: Step, dir: -1 | 1) => {
    const room = rooms.find(r => r.room === s.room)!;
    const i = room.steps.indexOf(s), j = i + dir;
    if (j < 0 || j >= room.steps.length) return;
    const list = [...room.steps]; [list[i], list[j]] = [list[j], list[i]];
    reorder(rooms.flatMap(r => (r.room === s.room ? list : r.steps)));
  };
  const moveRoom = (room: string, dir: -1 | 1) => {
    const i = rooms.findIndex(r => r.room === room), j = i + dir;
    if (j < 0 || j >= rooms.length) return;
    const list = [...rooms]; [list[i], list[j]] = [list[j], list[i]];
    reorder(list.flatMap(r => r.steps));
  };
  const addItem = async () => {
    if (!newItem.trim()) return;
    await call(`/checklist/${pid}/stock`, 'POST', { item: newItem });
    setNewItem('');
    load();
  };
  const removeItem = async (item: string) => {
    await apiFetch(`/checklist/${pid}/stock?item=${encodeURIComponent(item)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="px-2 h-14 flex items-center gap-1 border-b border-line">
        <Link to="/cleaners" className="icon-btn" aria-label={fr ? 'Retour' : 'Back'}><ChevronLeft size={20} /></Link>
        <h1 className="font-semibold">{fr ? 'Liste de ménage' : 'Cleaning checklist'}</h1>
      </div>
      <div className="p-4 space-y-4">
        {properties.length > 1 && (
          <div className="grid gap-1 p-1 rounded-xl bg-surface border border-line" style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(0, 1fr))` }} role="group" aria-label={fr ? 'Logement' : 'Property'}>
            {properties.map(p => (
              <button key={p.id} aria-pressed={pid === p.id} onClick={() => setPid(p.id)}
                className={`min-h-[40px] rounded-[9px] text-sm font-semibold truncate px-2 ${pid === p.id ? 'bg-tint text-accent' : 'text-muted'}`}>{p.name}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2" role="tablist">
          {(['steps', 'stock'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`chip ${tab === t ? 'chip-on' : ''}`}>
              {t === 'steps' ? (fr ? 'Étapes' : 'Steps') : 'Stock'}
            </button>
          ))}
        </div>

        {!steps && <div className="flex justify-center pt-10"><Loader2 className="animate-spin text-muted" size={24} aria-label="Loading" /></div>}

        {steps && tab === 'steps' && (
          <>
            <p className="text-sm text-muted">{fr
              ? 'Ce que l’agent coche à chaque ménage. L’appareil photo demande une photo pour l’étape ; la photo de référence montre le résultat attendu.'
              : 'What the cleaner ticks at each cleaning. The camera asks for a photo on that step; the reference photo shows the expected result.'}</p>
            {rooms.map((r, ri) => (
              <section key={r.room} className="card overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-1 border-b border-line">
                  <input defaultValue={r.room} aria-label={fr ? 'Nom de la pièce' : 'Room name'} onBlur={e => renameRoom(r.room, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent font-semibold text-[15px] px-1 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent" />
                  <button className="icon-btn w-9 h-9" disabled={ri === 0} onClick={() => moveRoom(r.room, -1)} aria-label={fr ? 'Monter la pièce' : 'Move room up'}><ArrowUp size={16} /></button>
                  <button className="icon-btn w-9 h-9" disabled={ri === rooms.length - 1} onClick={() => moveRoom(r.room, 1)} aria-label={fr ? 'Descendre la pièce' : 'Move room down'}><ArrowDown size={16} /></button>
                </div>
                {r.steps.map((s, si) => (
                  <div key={s.id} className="px-3 py-2 border-b border-line last:border-0 space-y-1">
                    <input defaultValue={s.label} aria-label={fr ? 'Étape' : 'Step'} onBlur={e => e.target.value.trim() && e.target.value !== s.label && patch(s, { label: e.target.value })}
                      className="w-full bg-transparent text-sm px-1 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent" />
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <button onClick={() => patch(s, { needsPhoto: !s.needsPhoto })} aria-pressed={s.needsPhoto}
                        className={`chip min-h-[32px] px-2.5 ${s.needsPhoto ? 'chip-on' : 'text-muted'}`}>
                        <Camera size={14} aria-hidden />{s.needsPhoto ? 'Photo' : (fr ? 'Sans photo' : 'No photo')}
                      </button>
                      {s.needsPhoto && pid && (
                        <>
                          {s.refPhotoId && <AuthImage id={s.refPhotoId} alt={fr ? 'Photo de référence' : 'Reference photo'} className="w-9 h-9 rounded-md" />}
                          <PhotoButton propertyId={pid} taskId={null} onUploaded={id => patch(s, { refPhotoId: id })} className="chip min-h-[32px] px-2.5"
                            label={s.refPhotoId ? (fr ? 'Changer' : 'Change') : (fr ? 'Référence' : 'Reference')} />
                          {s.refPhotoId && (
                            <button className="icon-btn w-8 h-8 text-muted" onClick={() => patch(s, { refPhotoId: null })} aria-label={fr ? 'Retirer la photo de référence' : 'Remove reference photo'}><X size={14} /></button>
                          )}
                        </>
                      )}
                      <span className="flex-1" />
                      <button className="icon-btn w-8 h-8" disabled={si === 0} onClick={() => moveStep(s, -1)} aria-label={fr ? 'Monter' : 'Move up'}><ArrowUp size={16} /></button>
                      <button className="icon-btn w-8 h-8" disabled={si === r.steps.length - 1} onClick={() => moveStep(s, 1)} aria-label={fr ? 'Descendre' : 'Move down'}><ArrowDown size={16} /></button>
                      <button className="icon-btn w-8 h-8 text-danger" onClick={() => remove(s)} aria-label={fr ? 'Supprimer' : 'Delete'}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => add(r.room)} className="w-full min-h-[44px] px-4 flex items-center gap-2 text-sm font-semibold text-accent hover:bg-page">
                  <Plus size={16} />{fr ? 'Ajouter une étape' : 'Add a step'}
                </button>
              </section>
            ))}
            <div className="flex gap-2">
              <input value={newRoom} onChange={e => setNewRoom(e.target.value)} placeholder={fr ? 'Nouvelle pièce (ex. : Terrasse)' : 'New room (e.g. Terrace)'}
                aria-label={fr ? 'Nouvelle pièce' : 'New room'} onKeyDown={e => e.key === 'Enter' && addRoom()}
                className="flex-1 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent" />
              <button className="btn-secondary" onClick={addRoom} disabled={!newRoom.trim()}><Plus size={16} />{fr ? 'Pièce' : 'Room'}</button>
            </div>
          </>
        )}

        {steps && tab === 'stock' && (
          <>
            <p className="text-sm text-muted">{fr ? 'Les produits que l’agent surveille dans ce logement.' : 'The products the cleaner keeps an eye on here.'}</p>
            <section className="card overflow-hidden">
              {stock.map(item => (
                <div key={item} className="min-h-[48px] pl-4 pr-2 flex items-center gap-2 border-b border-line last:border-0">
                  <span className="flex-1 text-sm">{item}</span>
                  <button className="icon-btn w-9 h-9 text-danger" onClick={() => removeItem(item)} aria-label={`${fr ? 'Retirer' : 'Remove'} ${item}`}><Trash2 size={16} /></button>
                </div>
              ))}
              {stock.length === 0 && <p className="p-4 text-sm text-muted">{fr ? 'Aucun produit.' : 'No products.'}</p>}
            </section>
            <div className="flex gap-2">
              <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={fr ? 'Ex. : Capsules café' : 'E.g. Coffee pods'}
                aria-label={fr ? 'Nouveau produit' : 'New product'} onKeyDown={e => e.key === 'Enter' && addItem()}
                className="flex-1 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent" />
              <button className="btn-secondary" onClick={addItem} disabled={!newItem.trim()}><Plus size={16} />{fr ? 'Ajouter' : 'Add'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
