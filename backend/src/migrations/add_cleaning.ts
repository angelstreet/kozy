import db from '../db.js';

/**
 * Cleaning tasks that follow Smoobu bookings, and the WhatsApp messages cleaners get.
 * - cleaning_task gains booking_ref (Smoobu reservation id, the stable key across syncs) and the
 *   time window: start_time on the check-out day, next guests' arrival day, time and count.
 * - property.cleaning_label / cleaning_show_guests: how the place is named in a cleaner's planning
 *   ("Haut", "Bas", "Villa") and whether the next guests' count is shown ("3(8)").
 * - cleaner.link_token: opens the cleaner's schedule page without a login.
 * - cleaner.owner_id: the owner (Clerk user) who added her; owner screens and APIs only show their own cleaners.
 * - cleaner.clerk_user_id: the Kozy account the cleaner created from her invite link (role 'cleaner').
 * - cleaner.credit_paid / credit_used / credit_as_of: prepaid packs ("9/12" in the planning). Used grows by 1
 *   per cleaning after credit_as_of, 2 on Sunday or a public holiday. NULL paid = paid per cleaning, no counter.
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

  const propCols = (await db.execute('PRAGMA table_info(property)')).rows.map((c: any) => c.name ?? c[1]);
  if (!propCols.includes('cleaning_label')) await db.execute('ALTER TABLE property ADD COLUMN cleaning_label TEXT');
  if (!propCols.includes('cleaning_show_guests')) await db.execute('ALTER TABLE property ADD COLUMN cleaning_show_guests INTEGER DEFAULT 0');

  const cleanerCols = (await db.execute('PRAGMA table_info(cleaner)')).rows.map((c: any) => c.name ?? c[1]);
  if (!cleanerCols.includes('link_token')) {
    await db.execute('ALTER TABLE cleaner ADD COLUMN link_token TEXT');
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaner_link_token ON cleaner(link_token)');
  }
  if (!cleanerCols.includes('owner_id')) {
    await db.execute('ALTER TABLE cleaner ADD COLUMN owner_id TEXT');
    await db.execute(`UPDATE cleaner SET owner_id = (SELECT p.user_id FROM property_cleaner pc JOIN property p ON p.id = pc.property_id
      WHERE pc.cleaner_id = cleaner.id AND p.user_id IS NOT NULL LIMIT 1) WHERE owner_id IS NULL`);
  }
  if (!cleanerCols.includes('clerk_user_id')) {
    await db.execute('ALTER TABLE cleaner ADD COLUMN clerk_user_id TEXT');
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaner_clerk_user ON cleaner(clerk_user_id)');
  }
  // planning_due: 'evening' (send at 19:00), 'now' (change for today or tomorrow), 'force' (owner: send now).
  if (!cleanerCols.includes('planning_due')) await db.execute('ALTER TABLE cleaner ADD COLUMN planning_due TEXT');
  if (!cleanerCols.includes('credit_paid')) {
    await db.execute('ALTER TABLE cleaner ADD COLUMN credit_paid INTEGER');
    await db.execute('ALTER TABLE cleaner ADD COLUMN credit_used INTEGER');
    await db.execute('ALTER TABLE cleaner ADD COLUMN credit_as_of TEXT');
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
