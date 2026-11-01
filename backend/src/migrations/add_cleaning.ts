import db from '../db.js';

/**
 * Cleaning tasks that follow Smoobu bookings, and the WhatsApp messages cleaners get.
 * - cleaning_task gains booking_ref (Smoobu reservation id, the stable key across syncs) and the
 *   time window: start_time on the check-out day, next guests' arrival day, time and count.
 * - cleaner.link_token: opens the cleaner's schedule page without a login.
 * - cleaner_message: outbox. openclaw pulls 'queued' rows, sends them by WhatsApp and marks them
 *   sent / failed. dry_run rows are only shown to the owner. dedupe_key stops repeats.
 */
export async function migrateCleaning() {
  const taskCols = (await db.execute('PRAGMA table_info(cleaning_task)')).rows.map((c: any) => c.name ?? c[1]);
  const add = async (col: string, type: string) => {
    if (!taskCols.includes(col)) await db.execute(`ALTER TABLE cleaning_task ADD COLUMN ${col} ${type}`);
  };
  await add('booking_ref', 'TEXT');
  await add('start_time', 'TEXT');
  await add('next_arrival', 'TEXT');
  await add('next_checkin', 'TEXT');
  await add('next_guests', 'INTEGER');
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaning_task_booking_ref ON cleaning_task(property_id, booking_ref)');

  const cleanerCols = (await db.execute('PRAGMA table_info(cleaner)')).rows.map((c: any) => c.name ?? c[1]);
  if (!cleanerCols.includes('link_token')) {
    await db.execute('ALTER TABLE cleaner ADD COLUMN link_token TEXT');
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaner_link_token ON cleaner(link_token)');
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cleaner_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      cleaner_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      phone TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT
    )
  `);
}
