import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reminderMessage, cleaningUnits, creditLine, deltaMessage, diffTasks, isFrenchHoliday, mergeSnapshot, MIN_DATES_PER_FLAT, planDelta,
  planningDates, planningMessage, planTasks, topUpDates, type StayForCleaning,
} from './plan.js';

const stay = (over: Partial<StayForCleaning>): StayForCleaning => ({
  ref: '1', apartmentId: 10, arrival: '2026-11-05', departure: '2026-11-08', checkIn: null, checkOut: null,
  guests: 2, isBlocked: false, cancelled: false, ...over,
});
const defaults = { checkIn: '16:00', checkOut: '10:00' };

test('one task per guest check-out, window ends at the next guest arrival', () => {
  const tasks = planTasks([
    stay({ ref: 'a', arrival: '2026-11-05', departure: '2026-11-08' }),
    stay({ ref: 'block', arrival: '2026-11-08', departure: '2026-11-09', isBlocked: true }),
    stay({ ref: 'gone', arrival: '2026-11-09', departure: '2026-11-10', cancelled: true }),
    stay({ ref: 'b', arrival: '2026-11-12', departure: '2026-11-14', checkIn: '15:00', guests: 4 }),
  ], '2026-11-01', '2026-12-31', defaults);
  assert.deepEqual(tasks.map((t) => [t.bookingRef, t.date, t.start, t.nextArrival, t.nextCheckIn, t.nextGuests]), [
    ['a', '2026-11-08', '10:00', '2026-11-12', '15:00', 4],
    ['b', '2026-11-14', '10:00', null, null, null],
  ]);
});

test('check-outs outside the window get no task', () => {
  assert.equal(planTasks([stay({ departure: '2026-10-30' })], '2026-11-01', '2026-11-30', defaults).length, 0);
});

test('diff: new, moved, changed window, cancelled; done tasks are never cancelled', () => {
  const planned = planTasks([
    stay({ ref: 'new', departure: '2026-11-08' }),
    stay({ ref: 'moved', arrival: '2026-11-15', departure: '2026-11-20' }),
    stay({ ref: 'same', arrival: '2026-11-21', departure: '2026-11-22' }),
    stay({ ref: 'next', arrival: '2026-11-22', departure: '2026-11-24' }),
  ], '2026-11-01', '2026-12-31', defaults);
  const ex = (ref: string, date: string, status = 'pending', nextArrival: string | null = null, nextCheckIn: string | null = null) =>
    ({ id: ref.length, bookingRef: ref, date, status, nextArrival, nextCheckIn });
  const changes = diffTasks([
    ex('moved', '2026-11-19', 'pending', '2026-11-21', '16:00'),
    ex('same', '2026-11-22', 'pending', '2026-11-25', '16:00'),
    ex('gone', '2026-11-30'),
    ex('cleaned', '2026-11-03', 'done'),
  ], planned);
  assert.deepEqual(changes.map((c) => [c.kind, (c.task as any).bookingRef, c.from ?? null]), [
    ['new', 'new', null],
    ['moved', 'moved', '2026-11-19'],
    ['changed', 'same', null],
    ['new', 'next', null],
    ['cancelled', 'gone', null],
  ]);
});

test('planning: days grouped by month, guests only where asked', () => {
  const t = (date: string, guests: number | null = null) => ({ date, guests });
  assert.equal(planningDates([t('2026-11-10'), t('2026-10-31'), t('2026-11-03'), t('2026-11-21')], false, 'fr'), '31 oct, 3, 10, 21 nov');
  assert.equal(planningDates([t('2026-10-31', 6), t('2026-11-03', 8), t('2026-11-21')], true, 'fr'), '31 oct(6), 3(8), 21 nov');
  assert.equal(planningMessage([
    { label: 'Haut', showGuests: false, tasks: [t('2026-10-31'), t('2026-11-03')] },
    { label: 'Bas', showGuests: false, tasks: [t('2026-10-29'), t('2026-11-05')] },
    { label: 'Villa', showGuests: true, tasks: [] },
  ], 'fr'), 'Bonjour,\nHaut : 31 oct, 3 nov\nBas : 29 oct, 5 nov');
});

test('pack counter: +1 per cleaning, +2 on Sunday and public holidays', () => {
  assert.equal(isFrenchHoliday('2026-11-11'), true);
  assert.equal(isFrenchHoliday('2027-03-29'), true); // Easter Monday 2027
  assert.equal(isFrenchHoliday('2026-05-14'), true); // Ascension 2026
  assert.equal(isFrenchHoliday('2026-11-12'), false);
  assert.equal(cleaningUnits('2026-11-08'), 2); // Sunday
  const credit = { paid: 12, used: 9, asOf: '2026-11-02' };
  const dates = ['2026-11-02', '2026-11-03', '2026-11-08', '2026-11-11', '2026-11-12'];
  assert.equal(creditLine(credit, dates, '2026-11-02'), '9/12');
  assert.equal(creditLine(credit, dates, '2026-11-03'), '10/12');
  assert.equal(creditLine(credit, dates, '2026-11-12'), '15/12');
});

test('evening reminder in the owner\'s words', () => {
  assert.equal(reminderMessage('Ester', ['en haut']), 'Bonjour Ester,\nPetit rappel demain intervention en haut');
  assert.equal(reminderMessage('Ester', ['en haut', 'en bas']), 'Bonjour Ester,\nPetit rappel demain intervention en haut et en bas');
});

test('top-up: a flat with fewer than 3 dates in the 3 weeks gets its next ones, others untouched', () => {
  assert.equal(MIN_DATES_PER_FLAT, 3);
  const t = (date: string) => ({ date, guests: null });
  const windowEnd = '2026-12-17'; // 27 nov + 21 days
  // Haut: 2 inside the window, then 20 déc and 28 déc beyond it: only the first one is added.
  const haut = topUpDates([t('2026-12-28'), t('2026-12-02'), t('2026-12-20'), t('2026-12-14')], windowEnd);
  assert.deepEqual(haut.map((x) => x.date), ['2026-12-02', '2026-12-14', '2026-12-20']);
  // Bas: 5 inside the window, nothing added (the one after the window stays out).
  const bas = topUpDates([t('2026-11-27'), t('2026-11-30'), t('2026-12-04'), t('2026-12-08'), t('2026-12-14'), t('2026-12-22')], windowEnd);
  assert.deepEqual(bas.map((x) => x.date), ['2026-11-27', '2026-11-30', '2026-12-04', '2026-12-08', '2026-12-14']);
  // Villa: 2 inside, no further dates: stays at 2, nothing invented.
  const villa = topUpDates([t('2026-11-29'), t('2026-12-12')], windowEnd);
  assert.deepEqual(villa.map((x) => x.date), ['2026-11-29', '2026-12-12']);
  // Same grouping as before: the month after the last day of each month.
  assert.equal(planningMessage([
    { label: 'Haut', showGuests: false, tasks: haut },
    { label: 'Bas', showGuests: false, tasks: bas },
  ], 'fr'), 'Bonjour,\nHaut : 2, 14, 20 déc\nBas : 27, 30 nov, 4, 8, 14 déc');
});

test('daily delta: only changed dates, passed dates are no change, top-up dates beyond the window are not cancelled', () => {
  const today = '2026-12-01', windowEnd = '2026-12-30';
  const known = [
    { label: 'Haut', dates: ['2026-11-30', '2026-12-02', '2026-12-14', '2026-12-20'] }, // 30 nov has passed
    { label: 'Bas', dates: ['2026-12-04', '2026-12-08', '2026-12-10'] },
    { label: 'Villa', dates: ['2026-12-12', '2027-01-15', '2027-02-02'] }, // topped up beyond the window
  ];
  const current = [
    { label: 'Haut', dates: ['2026-12-02', '2026-12-14', '2026-12-20', '2026-12-22'] },
    { label: 'Bas', dates: ['2026-12-04', '2026-12-10'] },
    { label: 'Villa', dates: ['2026-12-12', '2026-12-18', '2026-12-26'] }, // now 3 inside: no top-up needed
  ];
  const delta = planDelta(known, current, windowEnd, today);
  assert.deepEqual(delta, [
    { label: 'Haut', added: ['2026-12-22'], cancelled: [] },
    { label: 'Bas', added: [], cancelled: ['2026-12-08'] },
    { label: 'Villa', added: ['2026-12-18', '2026-12-26'], cancelled: [] },
  ]);
  assert.equal(deltaMessage(delta, 'fr'), 'Bonjour,\nHaut : 22 déc ajouté\nBas : 8 déc annulé\nVilla : 18, 26 déc ajoutés');
  assert.equal(deltaMessage(delta.slice(0, 2), 'en'), 'Hello,\nHaut: 22 Dec added\nBas: 8 Dec cancelled');
  // Same plan (a date passing is not a change): nothing.
  assert.deepEqual(planDelta(known, [current[0], known[1], known[2]].map((f, i) => i === 0 ? { ...f, dates: known[0].dates.slice(1) } : f), windowEnd, today), []);
});

test('snapshot merge: a 3-week planning keeps the later dates an earlier daily planning told', () => {
  const prev = [{ label: 'Haut', dates: ['2026-11-28', '2026-12-02', '2026-12-24', '2026-12-28'] }];
  // A 3-week planning on 1 dec (window to 21 dec) shows 2, 14 déc + its top-up 24 déc.
  const shown = [{ label: 'Haut', dates: ['2026-12-02', '2026-12-14', '2026-12-24'] }, { label: 'Bas', dates: ['2026-12-04'] }];
  assert.deepEqual(mergeSnapshot(prev, shown, '2026-12-21', '2026-12-01'), [
    { label: 'Haut', dates: ['2026-12-02', '2026-12-14', '2026-12-24', '2026-12-28'] },
    { label: 'Bas', dates: ['2026-12-04'] },
  ]);
});
