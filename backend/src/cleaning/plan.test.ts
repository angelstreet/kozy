import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffTasks, planTasks, scheduleLine, updateMessage, type StayForCleaning } from './plan.js';

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

test('message lines in French and English', () => {
  const line = { date: '2026-11-08', property: 'Gignac', start: '10:00', nextArrival: '2026-11-08', nextCheckIn: '16:00', nextGuests: 4 };
  assert.equal(scheduleLine(line, 'fr'), 'Dimanche 8 novembre, Gignac, à partir de 10h, avant 16h (arrivée le jour même, 4 pers.)');
  assert.equal(scheduleLine({ ...line, nextArrival: null }, 'en'), 'Sunday 8 November, Gignac, from 10:00, no arrival planned');
  assert.equal(scheduleLine({ ...line, nextArrival: '2026-11-10', nextGuests: 0 }, 'fr'), 'Dimanche 8 novembre, Gignac, à partir de 10h, avant mardi 10 novembre 16h');
  const msg = updateMessage([{ kind: 'moved', line, from: '2026-11-07' }], [line], 'fr', 'https://x/c/t');
  assert.match(msg, /^Kozy : votre planning de ménage a changé\./);
  assert.match(msg, /Déplacé : Dimanche 8 novembre.*\(au lieu du samedi 7 novembre\)/);
  assert.match(msg, /Détails : https:\/\/x\/c\/t$/);
});
