import db from './db.js';
import { fetchSmoobuBookings, type SmoobuReservation } from './smoobu-sync.js';
import { syncPropertyIcal } from './ical-sync.js';

/**
 * Unified sync: Use Smoobu API as primary source if configured, fallback to iCal
 */
export async function syncProperty(propertyId: number, userId: string): Promise<any> {
  // Check if user has Smoobu API key configured
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });

  const encryptedKey = keyResult.rows[0] ? (keyResult.rows[0] as any).smoobu_api_key_encrypted : null;

  if (encryptedKey) {
    // PRIMARY: Smoobu API
    return await syncPropertyFromSmoobu(propertyId, encryptedKey);
  } else {
    // FALLBACK: iCal
    return await syncPropertyIcal(propertyId);
  }
}

/**
 * Sync property from Smoobu API (creates bookings directly from Smoobu data)
 */
async function syncPropertyFromSmoobu(propertyId: number, encryptedKey: string): Promise<any> {
  const { decryptApiKey } = await import('./encryption.js');
  const apiKey = decryptApiKey(encryptedKey);

  // Get property details
  const propResult = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [propertyId] });
  const property = propResult.rows[0] as any;
  if (!property) throw new Error('Property not found');

  // Fetch all Smoobu reservations
  let smoobuReservations = await fetchSmoobuBookings(apiKey);

  // Filter by apartment ID if configured
  if (property.smoobu_apartment_id) {
    smoobuReservations = smoobuReservations.filter(r => r.apartment.id === property.smoobu_apartment_id);
  }

  // Get cleaner for this property
  const cleanerResult = await db.execute({
    sql: 'SELECT cleaner_id FROM property_cleaner WHERE property_id = ? AND role = ?',
    args: [propertyId, 'primary']
  });
  const cleanerId = cleanerResult.rows[0]?.cleaner_id ?? null;

  const getRate = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 ? (property.sunday_rate || 70) : (property.rate || 50);
  };

  let created = 0, updated = 0, tasksCreated = 0;

  // Sync each Smoobu reservation as a booking
  for (const res of smoobuReservations) {
    const icalUid = `smoobu-${res.id}`;

    // Check if booking already exists
    const existing = await db.execute({ sql: 'SELECT id FROM booking WHERE ical_uid = ?', args: [icalUid] });

    // Insert or update booking
    await db.execute({
      sql: `INSERT INTO booking (
        property_id, ical_uid, checkin_date, checkout_date, guest_name, source,
        email, phone, adults, children, checkin_time, checkout_time,
        price, price_paid, prepayment, prepayment_paid, deposit, deposit_paid,
        notice, language, channel_name, reference_id, apartment_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ical_uid) DO UPDATE SET
        checkin_date = excluded.checkin_date,
        checkout_date = excluded.checkout_date,
        guest_name = excluded.guest_name,
        source = excluded.source,
        email = excluded.email,
        phone = excluded.phone,
        adults = excluded.adults,
        children = excluded.children,
        checkin_time = excluded.checkin_time,
        checkout_time = excluded.checkout_time,
        price = excluded.price,
        price_paid = excluded.price_paid,
        prepayment = excluded.prepayment,
        prepayment_paid = excluded.prepayment_paid,
        deposit = excluded.deposit,
        deposit_paid = excluded.deposit_paid,
        notice = excluded.notice,
        language = excluded.language,
        channel_name = excluded.channel_name,
        reference_id = excluded.reference_id,
        apartment_name = excluded.apartment_name`,
      args: [
        propertyId,
        icalUid,
        res.arrival,
        res.departure,
        res['guest-name'] || `${res.firstname} ${res.lastname}`.trim() || 'Guest',
        'smoobu',
        res.email || null,
        res.phone || null,
        res.adults || 0,
        res.children || 0,
        res['check-in'] || null,
        res['check-out'] || null,
        res.price || 0,
        res['price-paid'] ? 1 : 0,
        res.prepayment || 0,
        res['prepayment-paid'] ? 1 : 0,
        res.deposit || 0,
        res['deposit-paid'] ? 1 : 0,
        res.notice || null,
        res.language || null,
        res.channel?.name || null,
        res['reference-id'] || null,
        res.apartment?.name || null,
      ],
    });

    const bookingRow = await db.execute({ sql: 'SELECT id FROM booking WHERE ical_uid = ?', args: [icalUid] });
    const bookingId = bookingRow.rows[0]?.id;

    if (existing.rows.length > 0) updated++; else created++;

    // Create cleaning task if needed
    const existingTask = await db.execute({
      sql: 'SELECT id FROM cleaning_task WHERE property_id = ? AND date = ? AND booking_id = ?',
      args: [propertyId, res.departure, bookingId],
    });

    if (existingTask.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO cleaning_task (property_id, booking_id, date, status, assigned_to, rate) VALUES (?, ?, ?, 'pending', ?, ?)`,
        args: [propertyId, bookingId, res.departure, cleanerId, getRate(res.departure)],
      });
      tasksCreated++;
    }
  }

  return {
    propertyId,
    propertyName: property.name,
    source: 'smoobu',
    bookingsFound: smoobuReservations.length,
    created,
    updated,
    tasksCreated,
  };
}
