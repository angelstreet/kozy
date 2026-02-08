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

  if (summary.startsWith('Reserved - ')) return summary.replace('Reserved - ', '');
  if (summary.startsWith('Closed - ')) return '';
  if (summary === 'Airbnb (Not available)') return '';
  if (summary === 'Not available') return '';

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

export async function syncBookingsToProperty(propertyId: number, bookings: ParsedBooking[]) {
  const propResult = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [propertyId] });
  const property = propResult.rows[0] as any;
  if (!property) throw new Error('Property not found');

  const cleanerResult = await db.execute({ sql: 'SELECT cleaner_id FROM property_cleaner WHERE property_id = ? AND role = ?', args: [propertyId, 'primary'] });
  const cleanerId = cleanerResult.rows[0]?.cleaner_id ?? null;

  const getRate = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 ? (property.sunday_rate || 70) : (property.rate || 50);
  };

  let created = 0, updated = 0, tasksCreated = 0;

  for (const b of bookings) {
    const existing = await db.execute({ sql: 'SELECT id FROM booking WHERE ical_uid = ?', args: [b.ical_uid] });

    await db.execute({
      sql: `INSERT INTO booking (property_id, ical_uid, checkin_date, checkout_date, guest_name, source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ical_uid) DO UPDATE SET
              checkin_date = excluded.checkin_date,
              checkout_date = excluded.checkout_date,
              guest_name = excluded.guest_name,
              source = excluded.source`,
      args: [propertyId, b.ical_uid, b.checkin_date, b.checkout_date, b.guest_name, b.source],
    });

    const bookingRow = await db.execute({ sql: 'SELECT id FROM booking WHERE ical_uid = ?', args: [b.ical_uid] });
    const bookingId = bookingRow.rows[0]?.id;

    if (existing.rows.length > 0) updated++; else created++;

    const existingTask = await db.execute({
      sql: 'SELECT id FROM cleaning_task WHERE property_id = ? AND date = ? AND booking_id = ?',
      args: [propertyId, b.checkout_date, bookingId],
    });
    if (existingTask.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO cleaning_task (property_id, booking_id, date, status, assigned_to, rate) VALUES (?, ?, ?, 'pending', ?, ?)`,
        args: [propertyId, bookingId, b.checkout_date, cleanerId, getRate(b.checkout_date)],
      });
      tasksCreated++;
    }
  }

  return { created, updated, tasksCreated };
}

export async function syncPropertyIcal(propertyId: number) {
  const propResult = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [propertyId] });
  const property = propResult.rows[0] as any;
  if (!property) throw new Error('Property not found');

  const urls: { url: string; source: string }[] = [];
  if (property.ical_airbnb) urls.push({ url: property.ical_airbnb, source: 'airbnb' });
  if (property.ical_booking) urls.push({ url: property.ical_booking, source: 'booking' });

  let allBookings: ParsedBooking[] = [];
  for (const { url } of urls) {
    const bookings = await fetchAndParseIcal(url);
    allBookings = allBookings.concat(bookings);
  }

  const result = await syncBookingsToProperty(propertyId, allBookings);
  return { propertyId, propertyName: property.name, bookingsFound: allBookings.length, ...result };
}
