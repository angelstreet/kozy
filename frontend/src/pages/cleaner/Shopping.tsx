import { apiFetch } from '@/api';
import { useApp } from '@/contexts/AppContext';
import { Loader2, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Item { item: string; level: 'ok' | 'low' | 'out' }
interface Prop { id: number; label: string; items: Item[] }

const LEVELS: { id: Item['level']; fr: string; en: string; on: string }[] = [
  { id: 'ok', fr: 'OK', en: 'OK', on: 'bg-tint text-accent border-accent' },
  { id: 'low', fr: 'Bas', en: 'Low', on: 'bg-warn-tint text-warn border-warn' },
  { id: 'out', fr: 'Vide', en: 'Out', on: 'bg-danger-tint text-danger border-danger' },
];

/** Stock per property (mockup screen 6): each product OK / Bas / Vide; Bas and Vide make the owner's shopping list. */
export default function Shopping() {
  const { lang } = useApp();
  const fr = lang === 'fr';
  const [props, setProps] = useState<Prop[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/visit/stock').then(r => r.json()).then(d => {
      setProps(d.properties || []);
      setCurrent(d.properties?.[0]?.id ?? null);
    }).catch(() => setProps([]));
  }, []);

  const set = async (propertyId: number, item: string, level: Item['level']) => {
    setProps(ps => ps!.map(p => (p.id !== propertyId ? p : { ...p, items: p.items.map(i => (i.item === item ? { ...i, level } : i)) })));
    await apiFetch(`/visit/stock/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, level }) });
  };

  if (!props) return <div className="flex justify-center pt-16"><Loader2 className="animate-spin text-muted" size={28} aria-label="Loading" /></div>;
  const p = props.find(x => x.id === current);
  const toBuy = p ? p.items.filter(i => i.level !== 'ok').length : 0;

  return (
    <div className="p-4 space-y-4 max-w-[640px] mx-auto">
      <h1 className="page-title">Stock</h1>
      {props.length > 1 && (
        <div className="grid gap-1 p-1 rounded-xl bg-surface border border-line" style={{ gridTemplateColumns: `repeat(${props.length}, minmax(0, 1fr))` }} role="group" aria-label={fr ? 'Logement' : 'Property'}>
          {props.map(x => (
            <button key={x.id} aria-pressed={current === x.id} onClick={() => setCurrent(x.id)}
              className={`min-h-[40px] rounded-[9px] text-sm font-semibold ${current === x.id ? 'bg-tint text-accent' : 'text-muted'}`}>{x.label}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted">{fr ? 'Touchez le niveau. « Bas » ou « Vide » ajoute le produit à la liste de courses.' : 'Tap the level. “Low” or “Out” puts the product on the shopping list.'}</p>
      {p && (
        <section className="card overflow-hidden">
          {p.items.map(i => (
            <div key={i.item} className="min-h-[56px] pl-4 pr-3 py-1.5 flex items-center gap-2.5 border-b border-line last:border-0">
              <span className="flex-1 text-sm">{i.item}</span>
              <div className="flex gap-1" role="group" aria-label={`${fr ? 'Niveau' : 'Level'} ${i.item}`}>
                {LEVELS.map(l => (
                  <button key={l.id} aria-pressed={i.level === l.id} onClick={() => set(p.id, i.item, l.id)}
                    className={`min-w-[52px] min-h-[36px] rounded-lg border text-xs font-semibold ${i.level === l.id ? l.on : 'bg-surface text-muted border-line'}`}>
                    {fr ? l.fr : l.en}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="rounded-xl bg-warn-tint text-warn px-4 py-3 flex items-center gap-2.5 text-sm font-semibold">
        <ShoppingCart size={18} aria-hidden />
        {toBuy ? (fr ? `${toBuy} produit${toBuy > 1 ? 's' : ''} sur la liste de courses` : `${toBuy} product${toBuy > 1 ? 's' : ''} on the shopping list`) : (fr ? 'Rien à racheter' : 'Nothing to buy')}
      </div>
    </div>
  );
}
