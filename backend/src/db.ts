import { createClient, Client } from '@libsql/client';

const db: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./db/kozy.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS property (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      ical_airbnb TEXT,
      ical_booking TEXT,
      checkout_time TEXT DEFAULT '10:00',
      checkin_time TEXT DEFAULT '16:00',
      cleaning_mins INTEGER DEFAULT 120,
      rate REAL DEFAULT 50,
      sunday_rate REAL DEFAULT 70,
      color TEXT DEFAULT '#3B82F6',
      enabled INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS cleaner (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      invite_token TEXT UNIQUE,
      invite_method TEXT CHECK(invite_method IN ('email','whatsapp')),
      invite_sent_at TEXT,
      invite_accepted_at TEXT,
      language TEXT DEFAULT 'fr'
    );
    CREATE TABLE IF NOT EXISTS property_cleaner (
      property_id INTEGER REFERENCES property(id),
      cleaner_id INTEGER REFERENCES cleaner(id),
      role TEXT CHECK(role IN ('primary','backup')) DEFAULT 'primary',
      PRIMARY KEY (property_id, cleaner_id)
    );
    CREATE TABLE IF NOT EXISTS booking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER REFERENCES property(id),
      ical_uid TEXT UNIQUE,
      checkin_date TEXT,
      checkout_date TEXT,
      guest_name TEXT,
      source TEXT
    );
    CREATE TABLE IF NOT EXISTS cleaning_task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER REFERENCES property(id),
      booking_id INTEGER REFERENCES booking(id),
      date TEXT,
      status TEXT CHECK(status IN ('pending','confirmed','in_progress','done')) DEFAULT 'pending',
      assigned_to INTEGER REFERENCES cleaner(id),
      rate REAL
    );
    CREATE TABLE IF NOT EXISTS payment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cleaner_id INTEGER REFERENCES cleaner(id),
      task_id INTEGER REFERENCES cleaning_task(id),
      amount REAL,
      paid INTEGER DEFAULT 0,
      paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS shopping_request (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER REFERENCES property(id),
      cleaner_id INTEGER REFERENCES cleaner(id),
      items TEXT,
      status TEXT CHECK(status IN ('pending','resolved')) DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_token (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key)
    );
  `);
}

export async function migrate() {
  const cols = await db.execute("PRAGMA table_info(property)");
  if (!cols.rows.find((c: any) => c[1] === 'enabled' || c.name === 'enabled')) {
    await db.execute('ALTER TABLE property ADD COLUMN enabled INTEGER DEFAULT 1');
  }
  // Add user_id to property for multi-tenant support (Clerk)
  if (!cols.rows.find((c: any) => c[1] === 'user_id' || c.name === 'user_id')) {
    await db.execute("ALTER TABLE property ADD COLUMN user_id TEXT");
  }

  // Add financial fields to property for cashflow tracking
  if (!cols.rows.find((c: any) => c[1] === 'purchase_price' || c.name === 'purchase_price')) {
    await db.execute("ALTER TABLE property ADD COLUMN purchase_price REAL");
    await db.execute("ALTER TABLE property ADD COLUMN travaux REAL DEFAULT 0");
    await db.execute("ALTER TABLE property ADD COLUMN monthly_charges REAL DEFAULT 0");
    await db.execute("ALTER TABLE property ADD COLUMN monthly_revenue REAL DEFAULT 0");
    await db.execute("ALTER TABLE property ADD COLUMN credit_mensuel REAL DEFAULT 0");
  }

  const cleanerCols = await db.execute("PRAGMA table_info(cleaner)");
  if (!cleanerCols.rows.find((c: any) => c[1] === 'invite_token' || c.name === 'invite_token')) {
    await db.execute("ALTER TABLE cleaner ADD COLUMN invite_token TEXT");
    await db.execute("ALTER TABLE cleaner ADD COLUMN invite_method TEXT");
    await db.execute("ALTER TABLE cleaner ADD COLUMN invite_sent_at TEXT");
    await db.execute("ALTER TABLE cleaner ADD COLUMN invite_accepted_at TEXT");
    await db.execute("ALTER TABLE cleaner ADD COLUMN language TEXT DEFAULT 'fr'");
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaner_invite_token ON cleaner(invite_token)");
  }

  // Run Smoobu fields migration
  const { migrateSmoobuFields } = await import('./migrations/add_smoobu_fields.js');
  await migrateSmoobuFields();

  // Add smoobu_apartment_id to property
  if (!cols.rows.find((c: any) => c[1] === 'smoobu_apartment_id' || c.name === 'smoobu_apartment_id')) {
    await db.execute("ALTER TABLE property ADD COLUMN smoobu_apartment_id INTEGER");
  }

  // Run encryption migration
  const { migrateEncryption } = await import('./migrations/add_encryption.js');
  await migrateEncryption();
}

export async function seed() {
  // Start EMPTY so onboarding triggers
}

export async function seedTestData() {
  await db.executeMultiple(`
    DELETE FROM shopping_request;
    DELETE FROM payment;
    DELETE FROM cleaning_task;
    DELETE FROM booking;
    DELETE FROM property_cleaner;
    DELETE FROM cleaner;
    DELETE FROM property;
  `);

  await db.execute({ sql: 'INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)', args: ['Studio Montmartre','12 Rue Lepic, Paris',50,70,'#3B82F6'] });
  await db.execute({ sql: 'INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)', args: ['Apt Marais','8 Rue de Turenne, Paris',60,80,'#10B981'] });
  await db.execute({ sql: 'INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)', args: ['Loft Bastille','3 Rue de la Roquette, Paris',55,75,'#F59E0B'] });

  await db.execute({ sql: 'INSERT INTO cleaner (name,email,phone) VALUES (?,?,?)', args: ['Test Owner','owner@example.com','+33612345678'] });
  await db.execute({ sql: 'INSERT INTO cleaner (name,email,phone) VALUES (?,?,?)', args: ['Test Cleaner','cleaner@example.com','+33698765432'] });

  await db.execute({ sql: 'INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)', args: [1,1,'primary'] });
  await db.execute({ sql: 'INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)', args: [2,1,'primary'] });
  await db.execute({ sql: 'INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)', args: [3,2,'primary'] });

  await db.execute({ sql: 'INSERT INTO booking (property_id,ical_uid,checkin_date,checkout_date,guest_name,source) VALUES (?,?,?,?,?,?)', args: [1,'uid-1','2026-02-10','2026-02-13','Alice Smith','airbnb'] });
  await db.execute({ sql: 'INSERT INTO booking (property_id,ical_uid,checkin_date,checkout_date,guest_name,source) VALUES (?,?,?,?,?,?)', args: [2,'uid-2','2026-02-11','2026-02-14','Bob Jones','booking.com'] });

  await db.execute({ sql: 'INSERT INTO cleaning_task (property_id,booking_id,date,status,assigned_to,rate) VALUES (?,?,?,?,?,?)', args: [1,1,'2026-02-13','pending',1,50] });
  await db.execute({ sql: 'INSERT INTO cleaning_task (property_id,booking_id,date,status,assigned_to,rate) VALUES (?,?,?,?,?,?)', args: [2,2,'2026-02-14','pending',1,60] });

  await db.execute({ sql: 'INSERT INTO payment (cleaner_id,task_id,amount,paid) VALUES (?,?,?,?)', args: [1,1,50,0] });
}

export async function clearAll() {
  await db.executeMultiple(`
    DELETE FROM shopping_request;
    DELETE FROM payment;
    DELETE FROM cleaning_task;
    DELETE FROM booking;
    DELETE FROM property_cleaner;
    DELETE FROM cleaner;
    DELETE FROM property;
  `);
}

export default db;
