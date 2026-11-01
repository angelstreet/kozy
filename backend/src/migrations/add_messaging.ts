import db from '../db.js';

/**
 * Automatic guest messages sent through Smoobu (send-message-to-guest).
 * - message_template: one row per user × key, with FR/EN bodies and a trigger
 *   (anchor = booking | arrival | departure, offset_days, send_time Europe/Paris).
 * - message_placeholder: per Smoobu apartment × language values for [k_*] tokens,
 *   encrypted (they hold door codes and wifi passwords).
 * - message_log: one row per booking × template × mode; 'sent' rows stop re-sends.
 * - message_settings: mode off | dry_run | live, and which channels may go live.
 */
export async function migrateMessaging() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS message_template (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      anchor TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      send_time TEXT,
      subject_fr TEXT,
      subject_en TEXT,
      body_fr TEXT NOT NULL,
      body_en TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, key)
    );
    CREATE TABLE IF NOT EXISTS message_placeholder (
      user_id TEXT NOT NULL,
      smoobu_apartment_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      lang TEXT NOT NULL,
      value_encrypted TEXT NOT NULL,
      PRIMARY KEY (user_id, smoobu_apartment_id, key, lang)
    );
    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      smoobu_booking_id INTEGER NOT NULL,
      template_key TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      channel TEXT,
      apartment_id INTEGER,
      guest_name TEXT,
      lang TEXT,
      send_at TEXT,
      body TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, smoobu_booking_id, template_key, mode)
    );
    CREATE TABLE IF NOT EXISTS message_settings (
      user_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'off',
      live_channels TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
