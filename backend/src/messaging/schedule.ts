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
  adults: number;
  children: number;
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

export function nightsBetween(arrival: string, departure: string): number {
  return Math.round((Date.parse(`${departure}T12:00:00Z`) - Date.parse(`${arrival}T12:00:00Z`)) / 86400000);
}

export function langFor(b: BookingForMessaging): Lang {
  return (b.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function formatDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2 adultes et 1 enfant" / "2 adults and 1 child"; children left out when 0. */
export function formatGuests(adults: number, children: number, lang: Lang): string {
  const a = lang === 'fr' ? plural(adults, 'adulte', 'adultes') : plural(adults, 'adult', 'adults');
  if (!children) return a;
  const c = lang === 'fr' ? plural(children, 'enfant', 'enfants') : plural(children, 'child', 'children');
  return `${a} ${lang === 'fr' ? 'et' : 'and'} ${c}`;
}

/** 'HH:MM' as "16h" / "16h30" in French, unchanged in English. */
export function formatTime(time: string, lang: Lang): string {
  if (lang !== 'fr') return time;
  const [h, m] = time.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
}

/**
 * Fill {first_name} {guest_name} {arrival} {departure} {checkin} {checkout} {guests}
 * {adults} {children} {nights} and the
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
    checkin: formatTime(b.checkIn || placeholders.k_checkin || defaults.checkIn, lang),
    checkout: formatTime(b.checkOut || placeholders.k_checkout || defaults.checkOut, lang),
    guests: formatGuests(b.adults, b.children, lang),
    adults: String(b.adults),
    children: String(b.children),
    nights: lang === 'fr' ? plural(nightsBetween(b.arrival, b.departure), 'nuit', 'nuits')
      : plural(nightsBetween(b.arrival, b.departure), 'night', 'nights'),
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
