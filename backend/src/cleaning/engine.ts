import crypto from 'crypto';
import db from '../db.js';
import { decryptApiKey } from '../encryption.js';
import { parseSmoobuCredentials } from '../smoobu-client.js';
import { fetchSmoobuBookings } from '../smoobu-sync.js';
import { addDays, type Lang } from '../messaging/schedule.js';
import {
  diffTasks, planTasks, reminderMessage, updateMessage, weekMessage,
  type ExistingTask, type ScheduleLine, type StayForCleaning, type TaskChange,
} from './plan.js';

export type CleanerMode = 'off' | 'dry_run' | 'live';

const MODE_KEY = 'cleaner_messages_mode';
const HORIZON_DAYS = 60; // tasks are kept this far ahead
const UPCOMING_DAYS = 14; // schedule shown in an update message
const REMINDER_HOUR = 18; // J-1 reminder and Sunday week plan, Paris time
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

interface Cleaner { id: number; phone: string | null; language: string | null }

async function enqueue(userId: string, mode: CleanerMode, cleaner: Cleaner, kind: string, key: string, body: string) {
  if (mode === 'off') return false;
  const status = mode === 'dry_run' ? 'dry_run' : cleaner.phone ? 'queued' : 'no_phone';
  const res = await db.execute({
    sql: `INSERT OR IGNORE INTO cleaner_message (user_id, cleaner_id, kind, dedupe_key, phone, body, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, cleaner.id, kind, `${mode}:${key}`, cleaner.phone, body, status],
  });
  return Number(res.rowsAffected) > 0;
}

const lineSql = `SELECT ct.date, p.name AS property, COALESCE(ct.start_time, p.checkout_time, '12:00') AS start,
  ct.next_arrival AS nextArrival, ct.next_checkin AS nextCheckIn, ct.next_guests AS nextGuests
  FROM cleaning_task ct JOIN property p ON p.id = ct.property_id`;

async function tasksFor(cleanerId: number, from: string, to: string): Promise<ScheduleLine[]> {
  return (await db.execute({
    sql: `${lineSql} WHERE ct.assigned_to = ? AND ct.date BETWEEN ? AND ? AND ct.status != 'done' ORDER BY ct.date, start`,
    args: [cleanerId, from, to],
  })).rows as any;
}

const langOf = (c: Cleaner): Lang => ((c.language || 'fr').startsWith('en') ? 'en' : 'fr');

/**
 * One tick for one owner: rebuild tasks from Smoobu (one per guest check-out, next arrival as the
 * deadline), tell each cleaner what changed with the next two weeks, then J-1 reminders after 18:00
 * and the week plan on Sunday after 18:00. The first run for a property only creates tasks.
 */
export async function runCleaning(userId: string, now = new Date()) {
  const mode = await getCleanerMode(userId);
  const user = (await db.execute({ sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?', args: [userId] })).rows[0] as any;
  if (!user?.smoobu_api_key_encrypted) return { userId, mode, error: 'no Smoobu key' };
  const creds = parseSmoobuCredentials(decryptApiKey(user.smoobu_api_key_encrypted));
  const reservations = await fetchSmoobuBookings(creds);

  const { date: today, hour, weekday } = parisClock(now);
  const horizon = addDays(today, HORIZON_DAYS);
  const props = (await db.execute({
    sql: `SELECT id, name, smoobu_apartment_id, checkout_time, checkin_time, rate, sunday_rate FROM property
          WHERE user_id = ? AND enabled = 1 AND smoobu_apartment_id IS NOT NULL`,
    args: [userId],
  })).rows as any[];

  const changesByCleaner = new Map<number, { kind: TaskChange['kind']; line: ScheduleLine; from?: string }[]>();
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
    const existingRows = (await db.execute({
      sql: `SELECT id, booking_ref, date, status, assigned_to, next_arrival, next_checkin FROM cleaning_task
            WHERE property_id = ? AND booking_ref IS NOT NULL AND date >= ?`,
      args: [p.id, today],
    })).rows as any[];
    const existing: ExistingTask[] = existingRows.map((t) => ({
      id: Number(t.id), bookingRef: String(t.booking_ref), date: String(t.date), status: String(t.status),
      nextArrival: t.next_arrival ?? null, nextCheckIn: t.next_checkin ?? null,
    }));
    // A failed or empty Smoobu answer must not cancel the whole schedule.
    if (!planned.length && existing.length > 1) {
      summary.push({ property: p.id, skipped: 'no stays from Smoobu, kept existing tasks' });
      continue;
    }
    const firstRun = Number(((await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM cleaning_task WHERE property_id = ? AND booking_ref IS NOT NULL', args: [p.id],
    })).rows[0] as any).n) === 0;
    const primary = ((await db.execute({
      sql: "SELECT cleaner_id FROM property_cleaner WHERE property_id = ? ORDER BY role = 'primary' DESC LIMIT 1", args: [p.id],
    })).rows[0] as any)?.cleaner_id ?? null;

    const changes = diffTasks(existing, planned);
    for (const ch of changes) {
      const t = ch.task as any;
      let cleanerId: number | null;
      if (ch.kind === 'cancelled') {
        cleanerId = existingRows.find((r) => Number(r.id) === t.id)?.assigned_to ?? null;
        await db.execute({ sql: 'DELETE FROM cleaning_task WHERE id = ?', args: [t.id] });
      } else if (ch.kind === 'new') {
        cleanerId = primary;
        const sunday = new Date(`${t.date}T12:00:00Z`).getUTCDay() === 0;
        await db.execute({
          sql: `INSERT INTO cleaning_task (property_id, date, status, assigned_to, rate, booking_ref, start_time, next_arrival, next_checkin, next_guests)
                VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
          args: [p.id, t.date, primary, sunday ? p.sunday_rate ?? p.rate : p.rate, t.bookingRef, t.start, t.nextArrival, t.nextCheckIn, t.nextGuests],
        });
      } else {
        cleanerId = existingRows.find((r) => String(r.booking_ref) === t.bookingRef)?.assigned_to ?? null;
        await db.execute({
          sql: `UPDATE cleaning_task SET date = ?, start_time = ?, next_arrival = ?, next_checkin = ?, next_guests = ?
                WHERE property_id = ? AND booking_ref = ?`,
          args: [t.date, t.start, t.nextArrival, t.nextCheckIn, t.nextGuests, p.id, t.bookingRef],
        });
      }
      // Changes far ahead are not worth a message: the week plan and the link cover them.
      if (firstRun || !cleanerId || t.date > addDays(today, UPCOMING_DAYS)) continue;
      const line: ScheduleLine = {
        date: t.date, property: p.name, start: t.start ?? p.checkout_time ?? '12:00',
        nextArrival: t.nextArrival ?? null, nextCheckIn: t.nextCheckIn ?? null, nextGuests: t.nextGuests ?? null,
      };
      if (!changesByCleaner.has(Number(cleanerId))) changesByCleaner.set(Number(cleanerId), []);
      changesByCleaner.get(Number(cleanerId))!.push({ kind: ch.kind, line, from: ch.from });
    }
    // Tasks made before the property had a cleaner: give them to the primary cleaner, announced as new.
    let assigned = 0;
    if (primary) {
      const orphans = (await db.execute({
        sql: `SELECT id, date, start_time, next_arrival, next_checkin, next_guests FROM cleaning_task
              WHERE property_id = ? AND booking_ref IS NOT NULL AND assigned_to IS NULL AND date >= ? AND status != 'done' ORDER BY date`,
        args: [p.id, today],
      })).rows as any[];
      for (const o of orphans) {
        await db.execute({ sql: 'UPDATE cleaning_task SET assigned_to = ? WHERE id = ?', args: [primary, o.id] });
        assigned++;
        if (o.date > addDays(today, UPCOMING_DAYS)) continue;
        if (!changesByCleaner.has(Number(primary))) changesByCleaner.set(Number(primary), []);
        changesByCleaner.get(Number(primary))!.push({ kind: 'new', line: {
          date: o.date, property: p.name, start: o.start_time ?? p.checkout_time ?? '12:00',
          nextArrival: o.next_arrival ?? null, nextCheckIn: o.next_checkin ?? null, nextGuests: o.next_guests ?? null,
        } });
      }
    }
    summary.push({ property: p.id, planned: planned.length, changes: changes.length, assigned, firstRun });
  }

  const cleaners = (await db.execute('SELECT id, phone, language FROM cleaner')).rows as any[];
  const byId = new Map(cleaners.map((c) => [Number(c.id), { id: Number(c.id), phone: c.phone ?? null, language: c.language ?? null }]));
  let messages = 0;

  for (const [cleanerId, changes] of changesByCleaner) {
    const c = byId.get(cleanerId);
    if (!c) continue;
    changes.sort((a, b) => a.line.date.localeCompare(b.line.date));
    const body = updateMessage(changes, await tasksFor(cleanerId, today, addDays(today, UPCOMING_DAYS)), langOf(c), await cleanerLink(cleanerId));
    const key = `update:${cleanerId}:${crypto.createHash('sha1').update(JSON.stringify(changes)).digest('hex').slice(0, 12)}`;
    if (await enqueue(userId, mode, c, 'update', key, body)) messages++;
  }

  if (hour >= REMINDER_HOUR) {
    const tomorrow = addDays(today, 1);
    const assigned = (await db.execute({
      sql: `SELECT DISTINCT ct.assigned_to AS id FROM cleaning_task ct JOIN property p ON p.id = ct.property_id
            WHERE p.user_id = ? AND ct.assigned_to IS NOT NULL AND ct.date BETWEEN ? AND ?`,
      args: [userId, tomorrow, addDays(today, 7)],
    })).rows as any[];
    for (const a of assigned) {
      const c = byId.get(Number(a.id));
      if (!c) continue;
      const link = await cleanerLink(c.id);
      const tomorrowLines = await tasksFor(c.id, tomorrow, tomorrow);
      if (tomorrowLines.length && await enqueue(userId, mode, c, 'reminder', `j1:${c.id}:${tomorrow}`, reminderMessage(tomorrowLines, langOf(c), link))) messages++;
      if (weekday === 0) {
        const week = await tasksFor(c.id, tomorrow, addDays(today, 7));
        if (await enqueue(userId, mode, c, 'week', `week:${c.id}:${tomorrow}`, weekMessage(week, langOf(c), link))) messages++;
      }
    }
  }

  return { userId, mode, today, properties: summary, messages };
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
