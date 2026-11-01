import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, parisToUtc, render, sendAtFor, skipReason, type BookingForMessaging, type MessageTemplate } from './schedule.js';

const booking = (over: Partial<BookingForMessaging> = {}): BookingForMessaging => ({
  id: 1, type: 'reservation', isBlocked: false, channel: 'Airbnb', apartmentId: 10,
  createdAt: '2026-11-01 14:30', arrival: '2026-11-10', departure: '2026-11-13',
  firstName: 'ana', guestName: 'Ana Silva', language: 'pt', checkIn: null, checkOut: null,
  price: 300, email: null, ...over,
});
const tpl = (over: Partial<MessageTemplate> = {}): MessageTemplate => ({
  key: 'checkin', anchor: 'arrival', offsetDays: 0, sendTime: '08:00',
  subject: { fr: null, en: null }, body: { fr: 'Bonjour {first_name}', en: 'Hello {first_name}' }, active: true, ...over,
});

test('parisToUtc handles summer and winter time', () => {
  assert.equal(parisToUtc('2026-07-01', '08:00').toISOString(), '2026-07-01T06:00:00.000Z');
  assert.equal(parisToUtc('2026-12-01', '08:00').toISOString(), '2026-12-01T07:00:00.000Z');
});

test('arrival-day message is due from 08:00 Paris, not before, not 2 days later', () => {
  const t = tpl(), b = booking();
  assert.equal(sendAtFor(t, b).toISOString(), '2026-11-10T07:00:00.000Z');
  assert.equal(isDue(t, b, new Date('2026-11-10T06:59:00Z')), false);
  assert.equal(isDue(t, b, new Date('2026-11-10T07:05:00Z')), true);
  assert.equal(isDue(t, b, new Date('2026-11-10T12:59:00Z')), true);
  assert.equal(isDue(t, b, new Date('2026-11-10T13:01:00Z')), false); // > 6 h late: skipped
});

test('confirmation is due right after booking', () => {
  const t = tpl({ key: 'confirmation', anchor: 'booking', sendTime: null });
  assert.equal(isDue(t, booking(), new Date('2026-11-01T13:31:00Z')), true);
  assert.equal(isDue(t, booking(), new Date('2026-11-01T13:29:00Z')), false);
});

test('J-3 message is skipped for a booking made after its send time', () => {
  const t = tpl({ key: 'pre_arrival', offsetDays: -3, sendTime: '10:00' });
  const late = booking({ createdAt: '2026-11-08 20:00' });
  assert.equal(isDue(t, late, new Date('2026-11-08T21:00:00Z')), false);
  assert.equal(isDue(t, booking(), new Date('2026-11-07T09:30:00Z')), true);
});

test('cancelled, blocked and owner blocks get nothing', () => {
  assert.equal(skipReason(booking({ type: 'cancellation' })), 'cancelled');
  assert.equal(skipReason(booking({ isBlocked: true })), 'blocked');
  assert.equal(skipReason(booking({ channel: 'Direct booking', price: 0 })), 'owner block');
  assert.equal(skipReason(booking({ channel: 'Direct booking', email: 'a@b.c' })), null);
});

test('render fills tokens, picks dates in the guest language and drops empty placeholder lines', () => {
  const text = 'Hello {first_name}, see you {arrival} from {checkin}.\nWifi: [k_wifi]\nParking: [k_parking]';
  const out = render(text, booking(), 'en', { k_wifi: 'NET / pass' }, { checkIn: '16:00', checkOut: '12:00' });
  assert.equal(out, 'Hello Ana, see you Tuesday 10 November from 16:00.\nWifi: NET / pass');
  assert.match(render('{arrival}', booking(), 'fr', {}, { checkIn: '16:00', checkOut: '12:00' }), /mardi 10 novembre/);
});
