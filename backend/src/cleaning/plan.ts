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
