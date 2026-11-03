import { apiFetch } from '@/api';
import { Camera, ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Shared bits of the cleaning screens: photo resize + upload, authenticated photo display, labels. */

export interface Step { id: number; label: string; needsPhoto: boolean; refPhotoId: number | null; done: boolean; photoId: number | null }
export interface VisitTask {
  id: number; date: string; status: string; propertyId: number; property: string; label: string; address: string | null;
  start: string; nextArrival: string | null; nextCheckIn: string | null; nextGuests: number | null;
  startedAt: string | null; finishedAt: string | null; finishNote: string | null; cleaner: string | null;
}
export interface Report { id: number; type: string; what: string; note: string | null; photoId: number | null; status: string; createdAt: string }
export interface VisitDetail {
  task: VisitTask; rooms: { room: string; steps: Step[] }[]; reports: Report[];
  progress: { done: number; total: number; photos: number; photosNeeded: number };
}

export const REPORT_TYPES: { id: string; fr: [string, string]; en: [string, string] }[] = [
  { id: 'missing', fr: ['Il manque', 'linge, ustensile, clé'], en: ['Missing', 'linen, utensil, key'] },
  { id: 'broken', fr: ['Cassé', 'ne marche plus'], en: ['Broken', 'not working'] },
  { id: 'product', fr: ['Produit à racheter', 'ménage, café, papier'], en: ['Product to buy', 'cleaning, coffee, paper'] },
  { id: 'damage', fr: ['Dégât voyageur', 'tache, casse, saleté'], en: ['Guest damage', 'stain, breakage, dirt'] },
];
export const reportLabel = (type: string, fr: boolean) => {
  const t = REPORT_TYPES.find(r => r.id === type);
  return t ? (fr ? t.fr[0] : t.en[0]) : type;
};

export const fmtDate = (d: string, fr: boolean) =>
  new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${d}T12:00:00Z`));
export const fmtTime = (t: string, fr: boolean) => (fr ? t.replace(/^0?(\d+):(\d\d)$/, (_, h, m) => `${h}h${m === '00' ? '' : m}`) : t);
export const fmtClock = (iso: string, fr: boolean) =>
  new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', fr ? 'h' : ':');

/** Phone photo → JPEG data URL, longest side 1280 px (~100 KB). */
export async function resizePhoto(file: File, max = 1280, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function uploadPhoto(file: File, propertyId: number, taskId: number | null): Promise<number> {
  const data = await resizePhoto(file);
  const res = await apiFetch('/visit/photos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, taskId, data }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'upload failed');
  return (await res.json()).id;
}

/** Photos are private: fetched with the session token, shown from a blob URL. */
export function AuthImage({ id, alt, className }: { id: number; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    apiFetch(`/visit/photos/${id}`)
      .then(r => (r.ok ? r.blob() : Promise.reject()))
      .then(b => { url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (failed) return <div className={`${className} bg-page flex items-center justify-center text-muted`} role="img" aria-label={alt}><ImageOff size={20} /></div>;
  if (!src) return <div className={`${className} bg-page animate-pulse`} role="img" aria-label={alt} />;
  return <img src={src} alt={alt} className={`${className} object-cover`} />;
}

/** Camera button: opens the phone camera, resizes, uploads, returns the photo id. */
export function PhotoButton({ propertyId, taskId, onUploaded, label, className }: {
  propertyId: number; taskId: number | null; onUploaded: (id: number) => void; label: string; className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setError('');
    try { onUploaded(await uploadPhoto(f, propertyId, taskId)); } catch (e: any) { setError(e.message); }
    setBusy(false);
    if (input.current) input.current.value = '';
  };
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} aria-hidden />}{label}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  );
}
