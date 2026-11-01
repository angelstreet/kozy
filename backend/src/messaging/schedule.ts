/**
 * Pure scheduling + rendering for automatic guest messages. No DB, no network: tested in
 * schedule.test.ts. All local times are Europe/Paris (where the properties are).
 */

export type Anchor = 'booking' | 'arrival' | 'departure';
export type Lang = 'fr' | 'en';

export interface MessageTemplate {
  key: string;
  anchor: Anchor;
  offsetDays: number;
  sendTime: string | null; // 'HH:MM' Paris; null with anchor 'booking' = right after booking
  subject: Record<Lang, string | null>;
  body: Record<Lang, string>;
  active: boolean;
}

export interface BookingForMessaging {
  id: number;
  type: string; // reservation | modification of booking | cancellation
  isBlocked: boolean;
  channel: string;
  apartmentId: number;
  createdAt: string; // Smoobu 'YYYY-MM-DD HH:MM', Paris local
  arrival: string; // 'YYYY-MM-DD'
  departure: string;
  firstName: string;
  guestName: string;
  language: string;
  checkIn: string | null; // 'HH:MM'
  checkOut: string | null;
  price: number;
  email: string | null;
}

const TZ = 'Europe/Paris';

/** UTC instant for a Paris wall-clock time (handles DST via Intl). */
export function parisToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asParis = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (asParis - guess));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function sendAtFor(t: MessageTemplate, b: BookingForMessaging): Date {
  if (t.anchor === 'booking') {
    const [date, time] = b.createdAt.split(' ');
    const at = parisToUtc(date, (time || '00:00').slice(0, 5));
    return new Date(at.getTime() + t.offsetDays * 86400000);
  }
  const base = t.anchor === 'arrival' ? b.arrival : b.departure;
  return parisToUtc(addDays(base, t.offsetDays), t.sendTime || '09:00');
}

/** Bookings that should never get automatic messages. */
export function skipReason(b: BookingForMessaging): string | null {
  if (b.type === 'cancellation') return 'cancelled';
  if (b.isBlocked) return 'blocked';
  if (b.channel === 'Direct booking' && !b.price) return 'owner block';
  if (b.channel === 'Direct booking' && !b.email) return 'no email';
  return null;
}

/**
 * Grace period: a run that misses the exact time still sends within this window, but an
 * arrival-day message is never sent a day late.
 */
export const GRACE_MS = 6 * 3600 * 1000;

/**
 * Whether template t is due for booking b at `now`.
 * Messages anchored on arrival/departure are not sent if the booking was made after
 * their send time (no "3 days before arrival" for a booking made yesterday), nor after
 * the grace window (so a first run doesn't flood old bookings).
 */
export function isDue(t: MessageTemplate, b: BookingForMessaging, now: Date): boolean {
  if (!t.active || skipReason(b)) return false;
  const at = sendAtFor(t, b);
  if (now < at || now.getTime() > at.getTime() + GRACE_MS) return false;
  if (t.anchor !== 'booking') {
    const [date, time] = b.createdAt.split(' ');
    if (parisToUtc(date, (time || '00:00').slice(0, 5)) > at) return false;
  }
  return true;
}

export function langFor(b: BookingForMessaging): Lang {
  return (b.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function formatDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Fill {first_name} {guest_name} {arrival} {departure} {checkin} {checkout} and the
 * apartment's [k_*] placeholders. A line whose [k_*] placeholders are all empty is dropped
 * (so "Parking: [k_parking]" disappears for a property without parking).
 */
export function render(
  text: string,
  b: BookingForMessaging,
  lang: Lang,
  placeholders: Record<string, string>,
  defaults: { checkIn: string; checkOut: string },
): string {
  const first = (b.firstName || b.guestName.split(' ')[0] || '').trim();
  const std: Record<string, string> = {
    first_name: first.charAt(0).toLocaleUpperCase() + first.slice(1),
    guest_name: b.guestName,
    arrival: formatDate(b.arrival, lang),
    departure: formatDate(b.departure, lang),
    checkin: b.checkIn || placeholders.k_checkin || defaults.checkIn,
    checkout: b.checkOut || placeholders.k_checkout || defaults.checkOut,
  };
  return text
    .split('\n')
    .filter((line) => {
      const ks = [...line.matchAll(/\[(k_[a-z_]+)\]/g)].map((m) => m[1]);
      return !(ks.length && ks.every((k) => !placeholders[k]));
    })
    .join('\n')
    .replace(/\{([a-z_]+)\}/g, (m, k) => (k in std ? std[k] : m))
    .replace(/\[(k_[a-z_]+)\]/g, (_, k) => placeholders[k] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
