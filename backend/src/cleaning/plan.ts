/**
 * Pure planning + text for cleaning tasks and the WhatsApp planning cleaners get.
 * No DB, no network: tested in plan.test.ts. Dates are 'YYYY-MM-DD', times 'HH:MM', Europe/Paris.
 */
import type { Lang } from '../messaging/schedule.js';

export interface StayForCleaning {
  ref: string; // Smoobu reservation id
  apartmentId: number;
  arrival: string;
  departure: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  isBlocked: boolean;
  cancelled: boolean;
}

export interface PlannedTask {
  bookingRef: string;
  date: string; // check-out day
  start: string; // check-out time
  nextArrival: string | null; // next check-in day on the same property
  nextCheckIn: string | null; // its check-in time
  nextGuests: number | null;
}

export interface ExistingTask {
  id: number;
  bookingRef: string;
  date: string;
  status: string;
  nextArrival: string | null;
  nextCheckIn: string | null;
}

export interface TaskChange {
  kind: 'new' | 'moved' | 'changed' | 'cancelled'; // changed = same day, next arrival moved
  task: PlannedTask | ExistingTask;
  from?: string; // previous date for 'moved'
}

/**
 * One task per guest check-out in [from, to]. The window ends at the next guest check-in on the same
 * property. Owner blocks and cancelled stays get no task and do not end a window.
 */
export function planTasks(
  stays: StayForCleaning[], from: string, to: string, defaults: { checkIn: string; checkOut: string },
): PlannedTask[] {
  const guests = stays.filter((s) => !s.isBlocked && !s.cancelled).sort((a, b) => a.arrival.localeCompare(b.arrival));
  return guests
    .filter((s) => s.departure >= from && s.departure <= to)
    .map((s) => {
      const next = guests.find((n) => n.ref !== s.ref && n.arrival >= s.departure);
      return {
        bookingRef: s.ref,
        date: s.departure,
        start: s.checkOut || defaults.checkOut,
        nextArrival: next?.arrival ?? null,
        nextCheckIn: next ? next.checkIn || defaults.checkIn : null,
        nextGuests: next ? next.guests : null,
      };
    });
}

/** What changed between the stored future tasks and the plan, keyed on the booking. */
export function diffTasks(existing: ExistingTask[], planned: PlannedTask[]) {
  const byRef = new Map(existing.map((t) => [t.bookingRef, t]));
  const plannedRefs = new Set(planned.map((p) => p.bookingRef));
  const changes: TaskChange[] = [];
  for (const p of planned) {
    const old = byRef.get(p.bookingRef);
    if (!old) changes.push({ kind: 'new', task: p });
    else if (old.date !== p.date) changes.push({ kind: 'moved', task: p, from: old.date });
    else if (old.nextArrival !== p.nextArrival || old.nextCheckIn !== p.nextCheckIn) changes.push({ kind: 'changed', task: p });
  }
  for (const t of existing) {
    if (!plannedRefs.has(t.bookingRef) && t.status !== 'done') changes.push({ kind: 'cancelled', task: t });
  }
  return changes;
}

const MONTHS: Record<Lang, string[]> = {
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export interface PlanningRow {
  label: string; // the cleaner's name for the place: "Haut", "Bas", "Villa"
  showGuests: boolean; // add the next guests' count: "3(8)"
  tasks: { date: string; guests: number | null }[];
}

/** "31 oct, 3, 10, 21 nov": days grouped by month, month written after the last day of each month. */
export function planningDates(tasks: PlanningRow['tasks'], showGuests: boolean, lang: Lang): string {
  const sorted = [...tasks].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((t, i) => {
    const month = t.date.slice(0, 7);
    const lastOfMonth = sorted[i + 1]?.date.slice(0, 7) !== month;
    const day = String(Number(t.date.slice(8, 10)));
    const mon = lastOfMonth ? ` ${MONTHS[lang][Number(t.date.slice(5, 7)) - 1]}` : '';
    return `${day}${mon}${showGuests && t.guests ? `(${t.guests})` : ''}`;
  }).join(', ');
}

/**
 * The whole message a cleaner gets, as the owner writes it by hand:
 *   Bonjour,
 *   Haut : 31 oct, 3, 10, 21 nov
 *   Bas : 29 oct, 5, 10, 22, 30 nov
 */
export function planningMessage(rows: PlanningRow[], lang: Lang): string {
  const sep = lang === 'fr' ? ' : ' : ': ';
  const lines = rows.filter((r) => r.tasks.length).map((r) => `${r.label}${sep}${planningDates(r.tasks, r.showGuests, lang)}`);
  return [lang === 'fr' ? 'Bonjour,' : 'Hello,', ...lines].join('\n');
}

/** Easter Sunday (anonymous Gregorian algorithm), 'YYYY-MM-DD'. */
function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** French public holidays (jours fériés): fixed dates + Easter Monday, Ascension, Whit Monday. */
export function isFrenchHoliday(date: string): boolean {
  const md = date.slice(5);
  if (['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].includes(md)) return true;
  const e = easter(Number(date.slice(0, 4)));
  return [shift(e, 1), shift(e, 39), shift(e, 50)].includes(date);
}

/** What a cleaning uses from a prepaid pack: 2 on Sunday or a public holiday, else 1. */
export function cleaningUnits(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 || isFrenchHoliday(date) ? 2 : 1;
}

/** "9/12": units used / units paid. Used = the count the owner gave on `asOf` + cleanings after it, up to today. */
export function creditLine(credit: { paid: number; used: number; asOf: string }, cleaningDates: string[], today: string): string {
  const used = credit.used + cleaningDates.filter((d) => d > credit.asOf && d <= today).reduce((n, d) => n + cleaningUnits(d), 0);
  return `${used}/${credit.paid}`;
}

/** "Bonjour Ester,\nPetit rappel demain intervention en haut et en bas" (the owner's own wording). */
export function reminderMessage(name: string, places: string[]): string {
  const list = places.length > 1 ? `${places.slice(0, -1).join(', ')} et ${places[places.length - 1]}` : places[0];
  return `Bonjour ${name},\nPetit rappel demain intervention ${list}`;
}
