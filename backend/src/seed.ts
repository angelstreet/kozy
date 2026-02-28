/**
 * seed.ts — Dev-only seed for cleaner testing (Task #829)
 * Idempotent: safe to run multiple times.
 * Seeds test data: assigns test cleaner to properties, creates 5 bookings,
 * cleaning tasks per checkout, and 2 shopping requests.
 */
import db from './db.js';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function seedCleanerTestData(): Promise<{ ok: boolean; message: string; details: any }> {
  // Find test cleaner by email (idempotent — doesn't assume a fixed id)
  let cleanerRow = await db.execute({
    sql: "SELECT id FROM cleaner WHERE email = 'cleaner@example.com' LIMIT 1",
    args: [],
  });
  let CLEANER_ID: number;
  if (cleanerRow.rows[0]) {
    CLEANER_ID = Number((cleanerRow.rows[0] as any).id);
  } else {
    // Create test cleaner if missing
    const ins = await db.execute({
      sql: "INSERT INTO cleaner (name, email, phone, status) VALUES ('Test Cleaner', 'cleaner@example.com', '+33698765432', 'active')",
      args: [],
    });
    CLEANER_ID = Number(ins.lastInsertRowid);
  }

  // Find properties by position (first two by ID)
  const propRows = await db.execute('SELECT id, rate FROM property ORDER BY id ASC LIMIT 2');
  if (propRows.rows.length < 2) throw new Error('Need at least 2 properties in DB');
  const PROP_7 = Number((propRows.rows[0] as any).id);
  const PROP_8 = Number((propRows.rows[1] as any).id);
  const rate7 = Number((propRows.rows[0] as any).rate) || 50;
  const rate8 = Number((propRows.rows[1] as any).rate) || 50;

  // --- 1. Assign cleaner to properties (idempotent) ---
  await db.execute({
    sql: 'INSERT OR REPLACE INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)',
    args: [PROP_7, CLEANER_ID, 'primary'],
  });
  await db.execute({
    sql: 'INSERT OR REPLACE INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)',
    args: [PROP_8, CLEANER_ID, 'backup'],
  });

  // --- 2. Bookings (keyed by ical_uid for idempotency) ---
  const bookings = [
    // Property 7: 3 bookings
    { property_id: PROP_7, ical_uid: 'seed-829-p7-1', guest_name: 'Pierre D', checkin: addDays(1), checkout: addDays(4), source: 'airbnb' },
    { property_id: PROP_7, ical_uid: 'seed-829-p7-2', guest_name: 'Marie L', checkin: addDays(5), checkout: addDays(8), source: 'booking.com' },
    { property_id: PROP_7, ical_uid: 'seed-829-p7-3', guest_name: 'John S', checkin: addDays(9), checkout: addDays(11), source: 'airbnb' },
    // Property 8: 2 bookings
    { property_id: PROP_8, ical_uid: 'seed-829-p8-1', guest_name: 'Sophie B', checkin: addDays(2), checkout: addDays(5), source: 'airbnb' },
    { property_id: PROP_8, ical_uid: 'seed-829-p8-2', guest_name: 'Alex M', checkin: addDays(7), checkout: addDays(10), source: 'booking.com' },
  ];

  const bookingIds: Record<string, number> = {};
  for (const b of bookings) {
    const existing = await db.execute({ sql: 'SELECT id FROM booking WHERE ical_uid = ?', args: [b.ical_uid] });
    if (existing.rows[0]) {
      bookingIds[b.ical_uid] = Number((existing.rows[0] as any).id);
    } else {
      const r = await db.execute({
        sql: 'INSERT INTO booking (property_id, ical_uid, checkin_date, checkout_date, guest_name, source) VALUES (?, ?, ?, ?, ?, ?)',
        args: [b.property_id, b.ical_uid, b.checkin, b.checkout, b.guest_name, b.source],
      });
      bookingIds[b.ical_uid] = Number(r.lastInsertRowid);
    }
  }

  // --- 3. Cleaning tasks (one per checkout) ---
  for (const b of bookings) {
    const bookingId = bookingIds[b.ical_uid];
    const rate = b.property_id === PROP_7 ? rate7 : rate8;
    const existing = await db.execute({ sql: 'SELECT id FROM cleaning_task WHERE booking_id = ?', args: [bookingId] });
    if (!existing.rows[0]) {
      await db.execute({
        sql: 'INSERT INTO cleaning_task (property_id, booking_id, date, status, assigned_to, rate) VALUES (?, ?, ?, ?, ?, ?)',
        args: [b.property_id, bookingId, b.checkout, 'pending', CLEANER_ID, rate],
      });
    }
  }

  // --- 4. Shopping requests (idempotent by content) ---
  const shop1 = await db.execute({
    sql: "SELECT id FROM shopping_request WHERE items = 'Need more towels and soap' AND property_id = ?",
    args: [PROP_7],
  });
  if (!shop1.rows[0]) {
    await db.execute({
      sql: 'INSERT INTO shopping_request (property_id, cleaner_id, items, status) VALUES (?, ?, ?, ?)',
      args: [PROP_7, CLEANER_ID, 'Need more towels and soap', 'pending'],
    });
  }

  const shop2 = await db.execute({
    sql: "SELECT id FROM shopping_request WHERE items = 'Light bulb bathroom replaced' AND property_id = ?",
    args: [PROP_8],
  });
  if (!shop2.rows[0]) {
    await db.execute({
      sql: 'INSERT INTO shopping_request (property_id, cleaner_id, items, status) VALUES (?, ?, ?, ?)',
      args: [PROP_8, CLEANER_ID, 'Light bulb bathroom replaced', 'resolved'],
    });
  }

  return {
    ok: true,
    message: 'Dev seed complete: cleaner assigned, 5 bookings, 5 cleaning tasks, 2 shopping requests',
    details: {
      cleaner_id: CLEANER_ID,
      property_7: PROP_7,
      property_8: PROP_8,
      bookings: bookings.map(b => ({ uid: b.ical_uid, guest: b.guest_name, checkin: b.checkin, checkout: b.checkout })),
    },
  };
}
