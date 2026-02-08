import ical from 'node-ical';
import db from './db.js';

export interface ParsedBooking {
  ical_uid: string;
  checkin_date: string;
  checkout_date: string;
  guest_name: string;
  description: string;
  source: string;
}

function formatDate(d: any): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().split('T')[0];
}

function detectSource(url: string): string {
  if (url.includes('airbnb')) return 'airbnb';
  if (url.includes('smoobu')) return 'smoobu';
  if (url.includes('booking.com')) return 'booking.com';
  return 'ical';
}

function extractGuestName(event: any): string {
  const summary = event.summary || '';
  const description = event.description || '';

  // Airbnb: SUMMARY is usually "Guest Name" or "Reserved - Guest Name"
  if (summary.startsWith('Reserved - ')) return summary.replace('Reserved - ', '');
  if (summary.startsWith('Closed - ')) return ''; // blocked dates
  if (summary === 'Airbnb (Not available)') return '';
  if (summary === 'Not available') return '';

  // Smoobu: guest name often in description
  const nameMatch = description.match(/(?:Guest|Name|Gast)[:\s]+(.+)/i);
  if (nameMatch) return nameMatch[1].trim();

  return summary || '';
}

export async function fetchAndParseIcal(url: string): Promise<ParsedBooking[]> {
  const data = await ical.async.fromURL(url);
  const source = detectSource(url);
  const bookings: ParsedBooking[] = [];

  for (const key of Object.keys(data)) {
    const event = data[key];
    if (event.type !== 'VEVENT') continue;
    if (!event.start || !event.end) continue;

    const checkin = formatDate(event.start);
    const checkout = formatDate(event.end);
    if (!checkin || !checkout) continue;

    // Skip blocked/unavailable dates with no guest info
    const summary = event.summary || '';
    if (summary === 'Not available' || summary === 'Airbnb (Not available)') continue;

    const guestName = extractGuestName(event);
    const uid = event.uid || `${checkin}-${checkout}-${source}`;

    bookings.push({
      ical_uid: uid,
      checkin_date: checkin,
      checkout_date: checkout,
      guest_name: guestName,
      description: event.description || '',
      source,
    });
  }

  return bookings.sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));
}

export function syncBookingsToProperty(propertyId: number, bookings: ParsedBooking[]) {
  const property = db.prepare('SELECT * FROM property WHERE id = ?').get(propertyId) as any;
  if (!property) throw new Error('Property not found');

  const upsertBooking = db.prepare(`
    INSERT INTO booking (property_id, ical_uid, checkin_date, checkout_date, guest_name, source)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ical_uid) DO UPDATE SET
      checkin_date = excluded.checkin_date,
      checkout_date = excluded.checkout_date,
      guest_name = excluded.guest_name,
      source = excluded.source
  `);

  const findTask = db.prepare('SELECT id FROM cleaning_task WHERE property_id = ? AND date = ? AND booking_id = ?');
  const insertTask = db.prepare(`
    INSERT INTO cleaning_task (property_id, booking_id, date, status, assigned_to, rate)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `);

  // Get primary cleaner
  const cleaner = db.prepare('SELECT cleaner_id FROM property_cleaner WHERE property_id = ? AND role = ?').get(propertyId, 'primary') as any;
  const cleanerId = cleaner?.cleaner_id || null;

  // Day of week rate
  const getRate = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 ? (property.sunday_rate || 70) : (property.rate || 50);
  };

  let created = 0, updated = 0, tasksCreated = 0;

  const syncAll = db.transaction(() => {
    for (const b of bookings) {
      const existing = db.prepare('SELECT id FROM booking WHERE ical_uid = ?').get(b.ical_uid) as any;
      upsertBooking.run(propertyId, b.ical_uid, b.checkin_date, b.checkout_date, b.guest_name, b.source);

      const booking = db.prepare('SELECT id FROM booking WHERE ical_uid = ?').get(b.ical_uid) as any;
      if (existing) updated++; else created++;

      // Auto-create cleaning task on checkout date
      const existingTask = findTask.get(propertyId, b.checkout_date, booking.id);
      if (!existingTask) {
        insertTask.run(propertyId, booking.id, b.checkout_date, cleanerId, getRate(b.checkout_date));
        tasksCreated++;
      }
    }
  });

  syncAll();
  return { created, updated, tasksCreated };
}

export async function syncPropertyIcal(propertyId: number) {
  const property = db.prepare('SELECT * FROM property WHERE id = ?').get(propertyId) as any;
  if (!property) throw new Error('Property not found');

  const urls: { url: string; source: string }[] = [];
  if (property.ical_airbnb) urls.push({ url: property.ical_airbnb, source: 'airbnb' });
  if (property.ical_booking) urls.push({ url: property.ical_booking, source: 'booking' });

  let allBookings: ParsedBooking[] = [];
  for (const { url } of urls) {
    const bookings = await fetchAndParseIcal(url);
    allBookings = allBookings.concat(bookings);
  }

  const result = syncBookingsToProperty(propertyId, allBookings);
  return { propertyId, propertyName: property.name, bookingsFound: allBookings.length, ...result };
}
