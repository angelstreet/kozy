/**
 * Pure planning + text for cleaning tasks and the WhatsApp messages cleaners get.
 * No DB, no network: tested in plan.test.ts. Dates are 'YYYY-MM-DD', times 'HH:MM', Europe/Paris.
 */
import { formatDate, formatTime, type Lang } from '../messaging/schedule.js';

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

export interface ScheduleLine {
  date: string;
  property: string;
  start: string;
  nextArrival: string | null;
  nextCheckIn: string | null;
  nextGuests: number | null;
}

const T = {
  fr: {
    update: 'Kozy : votre planning de ménage a changé.',
    new: 'Nouveau', moved: 'Déplacé', changed: 'Modifié', cancelled: 'Annulé', was: 'au lieu du',
    upcoming: 'Vos prochains ménages :', none: 'Aucun ménage prévu.',
    reminder: 'Rappel Kozy : ménage demain.',
    week: 'Kozy : vos ménages de la semaine.',
    from: 'à partir de', until: 'avant', sameDay: 'arrivée le jour même', free: 'pas d’arrivée prévue',
    people: (n: number) => `${n} pers.`,
    link: 'Détails :',
  },
  en: {
    update: 'Kozy: your cleaning schedule changed.',
    new: 'New', moved: 'Moved', changed: 'Changed', cancelled: 'Cancelled', was: 'instead of',
    upcoming: 'Your next cleanings:', none: 'No cleaning planned.',
    reminder: 'Kozy reminder: cleaning tomorrow.',
    week: 'Kozy: your cleanings this week.',
    from: 'from', until: 'before', sameDay: 'guests arrive the same day', free: 'no arrival planned',
    people: (n: number) => `${n} guest${n === 1 ? '' : 's'}`,
    link: 'Details:',
  },
};

/** "samedi 8 novembre"; capitalised when it starts a line. */
function shortDate(date: string, lang: Lang, capital = false): string {
  const d = formatDate(date, lang);
  return capital ? d.charAt(0).toUpperCase() + d.slice(1) : d;
}

/** "Saturday 8 November, Gignac, from 10:00, before 16:00 (same day, 4 guests)". */
export function scheduleLine(l: ScheduleLine, lang: Lang): string {
  const t = T[lang];
  let end: string;
  const notes = (sameDay: boolean) => [sameDay ? t.sameDay : null, l.nextGuests ? t.people(l.nextGuests) : null].filter(Boolean).join(', ');
  const paren = (s: string) => (s ? ` (${s})` : '');
  if (!l.nextArrival) end = t.free;
  else if (l.nextArrival === l.date) end = `${t.until} ${formatTime(l.nextCheckIn!, lang)}${paren(notes(true))}`;
  else end = `${t.until} ${shortDate(l.nextArrival, lang)} ${formatTime(l.nextCheckIn!, lang)}${paren(notes(false))}`;
  return `${shortDate(l.date, lang, true)}, ${l.property}, ${t.from} ${formatTime(l.start, lang)}, ${end}`;
}

function upcomingBlock(lines: ScheduleLine[], lang: Lang): string {
  const t = T[lang];
  return lines.length ? `${t.upcoming}\n${lines.map((l) => `- ${scheduleLine(l, lang)}`).join('\n')}` : t.none;
}

export function updateMessage(
  changes: { kind: TaskChange['kind']; line: ScheduleLine; from?: string }[], upcoming: ScheduleLine[], lang: Lang, link: string,
): string {
  const t = T[lang];
  const changeLines = changes.map((c) => {
    const was = c.kind === 'moved' && c.from ? ` (${t.was} ${shortDate(c.from, lang)})` : '';
    return `${t[c.kind]}${lang === 'fr' ? ' : ' : ': '}${scheduleLine(c.line, lang)}${was}`;
  });
  return [t.update, '', ...changeLines, '', upcomingBlock(upcoming, lang), '', `${t.link} ${link}`].join('\n');
}

export function reminderMessage(lines: ScheduleLine[], lang: Lang, link: string): string {
  const t = T[lang];
  return [t.reminder, ...lines.map((l) => `- ${scheduleLine(l, lang)}`), '', `${t.link} ${link}`].join('\n');
}

export function weekMessage(lines: ScheduleLine[], lang: Lang, link: string): string {
  const t = T[lang];
  return [t.week, '', lines.length ? lines.map((l) => `- ${scheduleLine(l, lang)}`).join('\n') : t.none, '', `${t.link} ${link}`].join('\n');
}
