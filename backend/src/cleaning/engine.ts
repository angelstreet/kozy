import crypto from 'crypto';
import db from '../db.js';
import { decryptApiKey } from '../encryption.js';
import { parseSmoobuCredentials } from '../smoobu-client.js';
import { fetchSmoobuBookings } from '../smoobu-sync.js';
import { addDays, type Lang } from '../messaging/schedule.js';
import { diffTasks, planningMessage, planTasks, type ExistingTask, type PlanningRow, type StayForCleaning } from './plan.js';

export type CleanerMode = 'off' | 'dry_run' | 'live';

const MODE_KEY = 'cleaner_messages_mode';
const TEST_PHONE_KEY = 'cleaner_messages_test_phone';
const HORIZON_DAYS = 60; // tasks are kept this far ahead
const APP_URL = process.env.KOZY_APP_URL || 'https://kozy-steel.vercel.app';

export async function getCleanerMode(userId: string): Promise<CleanerMode> {
  const row = (await db.execute({ sql: 'SELECT value FROM user_settings WHERE user_id = ? AND key = ?', args: [userId, MODE_KEY] })).rows[0] as any;
  return (row?.value as CleanerMode) || 'dry_run';
}

export async function setCleanerMode(userId: string, mode: CleanerMode) {
  await db.execute({
    sql: `INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [userId, MODE_KEY, mode],
  });
}

/** While set, every live message goes to this number (the owner's), headed with the cleaner's name. */
export async function getTestPhone(userId: string): Promise<string | null> {
  const row = (await db.execute({ sql: 'SELECT value FROM user_settings WHERE user_id = ? AND key = ?', args: [userId, TEST_PHONE_KEY] })).rows[0] as any;
  return row?.value || null;
}

export async function setTestPhone(userId: string, phone: string | null) {
  await db.execute({
    sql: `INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [userId, TEST_PHONE_KEY, phone],
  });
}

/** Paris wall clock: date, hour, weekday (0 = Sunday). */
export function parisClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return { date, hour: Number(get('hour')), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) };
}

/** Schedule page link for a cleaner; creates the token on first use. */
export async function cleanerLink(cleanerId: number): Promise<string> {
  const row = (await db.execute({ sql: 'SELECT link_token FROM cleaner WHERE id = ?', args: [cleanerId] })).rows[0] as any;
  let token = row?.link_token as string | null;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await db.execute({ sql: 'UPDATE cleaner SET link_token = ? WHERE id = ?', args: [token, cleanerId] });
  }
  return `${APP_URL}/s/${token}`;
}

interface Cleaner { id: number; name: string; phone: string | null; language: string | null }

const langOf = (c: Cleaner): Lang => ((c.language || 'fr').startsWith('en') ? 'en' : 'fr');

/** First day of this month → last day of next month: the span the owner's hand-written planning covers. */
function planningSpan(today: string): [string, string] {
  const [y, m] = today.split('-').map(Number);
  const end = new Date(Date.UTC(y, m + 1, 0)); // day 0 of the month after next = last day of next month
  return [`${today.slice(0, 7)}-01`, end.toISOString().slice(0, 10)];
}

async function planningFor(userId: string, cleaner: Cleaner, from: string, to: string): Promise<string | null> {
  const rows = (await db.execute({
    sql: `SELECT p.id, COALESCE(p.cleaning_label, p.name) AS label, p.cleaning_show_guests AS showGuests, ct.date, ct.next_guests AS guests
          FROM cleaning_task ct JOIN property p ON p.id = ct.property_id
          WHERE p.user_id = ? AND ct.assigned_to = ? AND ct.date BETWEEN ? AND ? ORDER BY p.id, ct.date`,
    args: [userId, cleaner.id, from, to],
  })).rows as any[];
  if (!rows.length) return null;
  const byProperty = new Map<number, PlanningRow>();
  for (const r of rows) {
    if (!byProperty.has(Number(r.id))) byProperty.set(Number(r.id), { label: String(r.label), showGuests: Boolean(r.showGuests), tasks: [] });
    byProperty.get(Number(r.id))!.tasks.push({ date: String(r.date), guests: r.guests == null ? null : Number(r.guests) });
  }
  return planningMessage([...byProperty.values()], langOf(cleaner));
}

/**
 * One tick for one owner: rebuild tasks from Smoobu (one per guest check-out, next arrival as the deadline,
 * open tasks follow the property's primary cleaner), then send each cleaner their planning for this month and
 * next whenever its text differs from the last one they got.
 */
export async function runCleaning(userId: string, now = new Date()) {
  const mode = await getCleanerMode(userId);
  const testPhone = await getTestPhone(userId);
  const user = (await db.execute({ sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?', args: [userId] })).rows[0] as any;
  if (!user?.smoobu_api_key_encrypted) return { userId, mode, error: 'no Smoobu key' };
  const creds = parseSmoobuCredentials(decryptApiKey(user.smoobu_api_key_encrypted));
  const reservations = await fetchSmoobuBookings(creds);

  const today = parisClock(now).date;
  const horizon = addDays(today, HORIZON_DAYS);
  const props = (await db.execute({
    sql: `SELECT id, name, smoobu_apartment_id, checkout_time, checkin_time, rate, sunday_rate FROM property
          WHERE user_id = ? AND enabled = 1 AND smoobu_apartment_id IS NOT NULL`,
    args: [userId],
  })).rows as any[];
  const summary: any[] = [];

  for (const p of props) {
    const stays: StayForCleaning[] = reservations
      .filter((r) => r.apartment?.id === Number(p.smoobu_apartment_id))
      .map((r) => ({
        ref: String(r.id), apartmentId: r.apartment.id, arrival: r.arrival, departure: r.departure,
        checkIn: r['check-in'] || null, checkOut: r['check-out'] || null,
        guests: (Number(r.adults) || 0) + (Number(r.children) || 0),
        isBlocked: Boolean(r['is-blocked-booking']), cancelled: r.type === 'cancellation',
      }));
    const planned = planTasks(stays, today, horizon, { checkIn: p.checkin_time || '16:00', checkOut: p.checkout_time || '12:00' });
    const existing: ExistingTask[] = ((await db.execute({
      sql: `SELECT id, booking_ref, date, status, next_arrival, next_checkin FROM cleaning_task
            WHERE property_id = ? AND booking_ref IS NOT NULL AND date >= ?`,
      args: [p.id, today],
    })).rows as any[]).map((t) => ({
      id: Number(t.id), bookingRef: String(t.booking_ref), date: String(t.date), status: String(t.status),
      nextArrival: t.next_arrival ?? null, nextCheckIn: t.next_checkin ?? null,
    }));
    // A failed or empty Smoobu answer must not cancel the whole schedule.
    if (!planned.length && existing.length > 1) {
      summary.push({ property: p.id, skipped: 'no stays from Smoobu, kept existing tasks' });
      continue;
    }
    const primary = ((await db.execute({
      sql: "SELECT cleaner_id FROM property_cleaner WHERE property_id = ? ORDER BY role = 'primary' DESC LIMIT 1", args: [p.id],
    })).rows[0] as any)?.cleaner_id ?? null;

    const changes = diffTasks(existing, planned);
    for (const ch of changes) {
      const t = ch.task as any;
      if (ch.kind === 'cancelled') {
        await db.execute({ sql: 'DELETE FROM cleaning_task WHERE id = ?', args: [t.id] });
      } else if (ch.kind === 'new') {
        const sunday = new Date(`${t.date}T12:00:00Z`).getUTCDay() === 0;
        await db.execute({
          sql: `INSERT INTO cleaning_task (property_id, date, status, assigned_to, rate, booking_ref, start_time, next_arrival, next_checkin, next_guests)
                VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
          args: [p.id, t.date, primary, sunday ? p.sunday_rate ?? p.rate : p.rate, t.bookingRef, t.start, t.nextArrival, t.nextCheckIn, t.nextGuests],
        });
      } else {
        await db.execute({
          sql: `UPDATE cleaning_task SET date = ?, start_time = ?, next_arrival = ?, next_checkin = ?, next_guests = ?
                WHERE property_id = ? AND booking_ref = ?`,
          args: [t.date, t.start, t.nextArrival, t.nextCheckIn, t.nextGuests, p.id, t.bookingRef],
        });
      }
    }
    // Open tasks follow the property's primary cleaner (added later, or changed).
    const reassigned = primary ? Number((await db.execute({
      sql: `UPDATE cleaning_task SET assigned_to = ? WHERE property_id = ? AND booking_ref IS NOT NULL AND date >= ?
            AND status = 'pending' AND (assigned_to IS NULL OR assigned_to != ?)`,
      args: [primary, p.id, today, primary],
    })).rowsAffected) : 0;
    summary.push({ property: p.id, planned: planned.length, changes: changes.length, reassigned });
  }

  // One planning per cleaner of this owner (or who had one before: their last task may have moved away).
  const [from, to] = planningSpan(today);
  const cleaners = (await db.execute({
    sql: `SELECT DISTINCT c.id, c.name, c.phone, c.language FROM cleaner c
          WHERE c.id IN (SELECT ct.assigned_to FROM cleaning_task ct JOIN property p ON p.id = ct.property_id WHERE p.user_id = ?)
             OR c.id IN (SELECT cleaner_id FROM cleaner_message WHERE user_id = ?)`,
    args: [userId, userId],
  })).rows as any[];
  let messages = 0;
  for (const r of cleaners) {
    const c: Cleaner = { id: Number(r.id), name: String(r.name), phone: r.phone ?? null, language: r.language ?? null };
    const body = await planningFor(userId, c, from, to);
    if (!body) continue;
    const last = (await db.execute({
      sql: "SELECT body FROM cleaner_message WHERE user_id = ? AND cleaner_id = ? AND kind = 'planning' AND dedupe_key LIKE ? ORDER BY id DESC LIMIT 1",
      args: [userId, c.id, `${mode}:%`],
    })).rows[0] as any;
    if (last?.body === body || mode === 'off') continue;
    const phone = testPhone || c.phone;
    const status = mode === 'dry_run' ? 'dry_run' : phone ? 'queued' : 'no_phone';
    // Redirected messages carry the cleaner's name so the owner knows whose planning it is; the stored body stays clean.
    await db.execute({
      sql: `INSERT INTO cleaner_message (user_id, cleaner_id, kind, dedupe_key, phone, body, status) VALUES (?, ?, 'planning', ?, ?, ?, ?)`,
      args: [userId, c.id, `${mode}:planning:${c.id}:${now.getTime()}`, phone, body, status],
    });
    messages++;
  }

  return { userId, mode, testPhone: Boolean(testPhone), today, properties: summary, messages };
}

/** Scheduler entry point: every owner with a Smoobu key, unless cleaner messages are off. */
export async function runCleaningForAll(now = new Date()) {
  const users = (await db.execute(`SELECT DISTINCT p.user_id FROM property p JOIN user u ON u.id = p.user_id
    WHERE p.smoobu_apartment_id IS NOT NULL AND u.smoobu_api_key_encrypted IS NOT NULL`)).rows as any[];
  const results = [];
  for (const u of users) {
    try {
      results.push(await runCleaning(String(u.user_id), now));
    } catch (e: any) {
      results.push({ userId: u.user_id, error: e.message });
    }
  }
  return results;
}

/** Public schedule page for a cleaner (token from their WhatsApp link). */
export async function cleanerSchedule(token: string, now = new Date()) {
  const c = (await db.execute({ sql: 'SELECT id, name, language FROM cleaner WHERE link_token = ?', args: [token] })).rows[0] as any;
  if (!c) return null;
  const today = parisClock(now).date;
  const tasks = (await db.execute({
    sql: `SELECT ct.id, ct.date, ct.status, p.name AS property, p.address, COALESCE(ct.start_time, p.checkout_time, '12:00') AS start,
            ct.next_arrival AS nextArrival, ct.next_checkin AS nextCheckIn, ct.next_guests AS nextGuests
          FROM cleaning_task ct JOIN property p ON p.id = ct.property_id
          WHERE ct.assigned_to = ? AND ct.date BETWEEN ? AND ? ORDER BY ct.date, start`,
    args: [c.id, today, addDays(today, 30)],
  })).rows;
  return { name: c.name, language: c.language || 'fr', today, tasks };
}
