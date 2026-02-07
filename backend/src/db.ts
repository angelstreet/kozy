import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'db', 'kozy.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB() {
  db.exec(`
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
      color TEXT DEFAULT '#3B82F6'
    );
    CREATE TABLE IF NOT EXISTS cleaner (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active'
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
      ical_uid TEXT,
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
  `);
}

export function seed() {
  // Start EMPTY so onboarding triggers
  // Use /api/seed to populate test data
}

export function seedTestData() {
  // Clear all tables
  db.exec('DELETE FROM shopping_request');
  db.exec('DELETE FROM payment');
  db.exec('DELETE FROM cleaning_task');
  db.exec('DELETE FROM booking');
  db.exec('DELETE FROM property_cleaner');
  db.exec('DELETE FROM cleaner');
  db.exec('DELETE FROM property');

  db.prepare('INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)').run('Studio Montmartre','12 Rue Lepic, Paris',50,70,'#3B82F6');
  db.prepare('INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)').run('Apt Marais','8 Rue de Turenne, Paris',60,80,'#10B981');
  db.prepare('INSERT INTO property (name,address,rate,sunday_rate,color) VALUES (?,?,?,?,?)').run('Loft Bastille','3 Rue de la Roquette, Paris',55,75,'#F59E0B');

  db.prepare('INSERT INTO cleaner (name,email,phone) VALUES (?,?,?)').run('Marie Dupont','marie@example.com','+33612345678');
  db.prepare('INSERT INTO cleaner (name,email,phone) VALUES (?,?,?)').run('Jean Martin','jean@example.com','+33698765432');

  db.prepare('INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)').run(1,1,'primary');
  db.prepare('INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)').run(2,1,'primary');
  db.prepare('INSERT INTO property_cleaner (property_id,cleaner_id,role) VALUES (?,?,?)').run(3,2,'primary');

  db.prepare('INSERT INTO booking (property_id,ical_uid,checkin_date,checkout_date,guest_name,source) VALUES (?,?,?,?,?,?)').run(1,'uid-1','2026-02-10','2026-02-13','Alice Smith','airbnb');
  db.prepare('INSERT INTO booking (property_id,ical_uid,checkin_date,checkout_date,guest_name,source) VALUES (?,?,?,?,?,?)').run(2,'uid-2','2026-02-11','2026-02-14','Bob Jones','booking.com');

  db.prepare('INSERT INTO cleaning_task (property_id,booking_id,date,status,assigned_to,rate) VALUES (?,?,?,?,?,?)').run(1,1,'2026-02-13','pending',1,50);
  db.prepare('INSERT INTO cleaning_task (property_id,booking_id,date,status,assigned_to,rate) VALUES (?,?,?,?,?,?)').run(2,2,'2026-02-14','pending',1,60);

  db.prepare('INSERT INTO payment (cleaner_id,task_id,amount,paid) VALUES (?,?,?,?)').run(1,1,50,0);
}

export function clearAll() {
  db.exec('DELETE FROM shopping_request');
  db.exec('DELETE FROM payment');
  db.exec('DELETE FROM cleaning_task');
  db.exec('DELETE FROM booking');
  db.exec('DELETE FROM property_cleaner');
  db.exec('DELETE FROM cleaner');
  db.exec('DELETE FROM property');
}

export default db;
