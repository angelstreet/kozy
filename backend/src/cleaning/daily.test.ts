import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// A throwaway SQLite file: db.ts reads the URL when first imported, so set it before the dynamic imports.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kozy-daily-test-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.ENCRYPTION_KEY ??= '0'.repeat(64);
const { default: db, initDB } = await import('../db.js');
const { migrateCleaning } = await import('../migrations/add_cleaning.js');
const { dailyPlannings, sendPlannings, DAILY_HOUR, DAILY_HORIZON_DAYS, DAILY_PLAN_MODE } = await import('./engine.js');

await initDB();
await db.execute('ALTER TABLE property ADD COLUMN user_id TEXT');
await migrateCleaning();
await migrateCleaning(); // idempotent

// Paris is UTC+1 in winter.
const paris = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`);
const plannings = async () => (await db.execute(
  "SELECT body FROM cleaner_message WHERE kind = 'planning' AND cleaner_id = 5 ORDER BY id",
)).rows.map((r: any) => String(r.body));

test('daily planning: silent when unchanged, delta when changed, once a day, not before 08:00, full mode', async () => {
  assert.equal(DAILY_HOUR, 8);
  assert.equal(DAILY_HORIZON_DAYS, 30);
  assert.equal(DAILY_PLAN_MODE, 'delta');
  await db.execute("INSERT INTO property (id, name, user_id, cleaning_label) VALUES (1, 'Haut', 'u1', 'Haut'), (2, 'Bas', 'u1', 'Bas')");
  await db.execute("INSERT INTO cleaner (id, name, phone) VALUES (5, 'Ester', '+33600000005')");
  await db.execute(`INSERT INTO cleaning_task (property_id, date, status, assigned_to) VALUES
    (1, '2026-12-02', 'pending', 5), (1, '2026-12-14', 'pending', 5), (1, '2026-12-20', 'pending', 5),
    (2, '2026-12-04', 'pending', 5), (2, '2026-12-08', 'pending', 5), (2, '2026-12-10', 'pending', 5)`);

  // Sunday 19:30: the weekly planning, which records what she was told (and the daily pass stays quiet on Sunday).
  assert.equal(await sendPlannings('u1', paris('2026-11-29', '19:30'), 'dry_run', null), 1);
  assert.deepEqual(await plannings(), ['Bonjour,\nHaut : 2, 14, 20 déc\nBas : 4, 8, 10 déc']);
  const snap = (await db.execute('SELECT plan_json, mode FROM cleaner_plan_sent WHERE cleaner_id = 5')).rows[0] as any;
  assert.equal(snap.mode, 'dry_run');
  assert.deepEqual(JSON.parse(snap.plan_json), [
    { label: 'Haut', dates: ['2026-12-02', '2026-12-14', '2026-12-20'] },
    { label: 'Bas', dates: ['2026-12-04', '2026-12-08', '2026-12-10'] },
  ]);

  // (e) Monday 07:50: before DAILY_HOUR, nothing (and the day is not used up).
  assert.equal(await dailyPlannings('u1', paris('2026-11-30', '07:50'), 'dry_run', null), 0);
  // (b) Monday 08:10: same plan as Sunday's: no message.
  assert.equal(await dailyPlannings('u1', paris('2026-11-30', '08:10'), 'dry_run', null), 0);
  assert.equal((await plannings()).length, 1);

  // A date added beyond the 3 weeks (22 déc, markDue ignores it) and one cancelled, during Monday.
  await db.execute("INSERT INTO cleaning_task (property_id, date, status, assigned_to) VALUES (1, '2026-12-22', 'pending', 5)");
  await db.execute("DELETE FROM cleaning_task WHERE property_id = 2 AND date = '2026-12-08'");
  // (d) Monday's daily pass already ran: not again the same day.
  assert.equal(await dailyPlannings('u1', paris('2026-11-30', '12:00'), 'dry_run', null), 0);

  // (a) Tuesday 08:10: only what changed.
  assert.equal(await dailyPlannings('u1', paris('2026-12-01', '08:10'), 'dry_run', null), 1);
  assert.equal((await plannings()).at(-1), 'Bonjour,\nHaut : 22 déc ajouté\nBas : 8 déc annulé');
  // (d) Not twice on Tuesday: neither by the day stamp, nor (stamp cleared) because a planning went out today.
  assert.equal(await dailyPlannings('u1', paris('2026-12-01', '10:00'), 'dry_run', null), 0);
  await db.execute('UPDATE cleaner SET planning_daily_checked = NULL');
  await db.execute("INSERT INTO cleaning_task (property_id, date, status, assigned_to) VALUES (2, '2026-12-24', 'pending', 5)");
  assert.equal(await dailyPlannings('u1', paris('2026-12-01', '10:10'), 'dry_run', null), 0);
  assert.equal((await plannings()).length, 2);

  // (c) Wednesday, full mode: the whole list over 30 days, as planningMessage writes it.
  assert.equal(await dailyPlannings('u1', paris('2026-12-02', '08:10'), 'dry_run', null, 'full'), 1);
  assert.equal((await plannings()).at(-1), 'Bonjour,\nHaut : 2, 14, 20, 22 déc\nBas : 4, 10, 24 déc');
  // Thursday: nothing changed since Wednesday's (2 déc has passed, which is no change).
  assert.equal(await dailyPlannings('u1', paris('2026-12-03', '08:10'), 'dry_run', null), 0);
});

test('daily planning: top-up to 3 dates per flat, and a date beyond 30 days enters as the window moves', async () => {
  await db.execute("INSERT INTO property (id, name, user_id, cleaning_label) VALUES (3, 'Villa', 'u1', 'Villa')");
  await db.execute("INSERT INTO cleaner (id, name, phone) VALUES (7, 'Lina', '+33600000007')");
  await db.execute(`INSERT INTO cleaning_task (property_id, date, status, assigned_to) VALUES
    (3, '2026-12-05', 'pending', 7), (3, '2027-01-20', 'pending', 7), (3, '2027-02-10', 'pending', 7), (3, '2027-03-01', 'pending', 7)`);
  const lina = async () => (await db.execute("SELECT body FROM cleaner_message WHERE cleaner_id = 7 ORDER BY id")).rows.map((r: any) => String(r.body));
  // Never told anything: the full list, topped up to 3 dates.
  assert.equal(await dailyPlannings('u1', paris('2026-12-04', '08:10'), 'dry_run', null), 1);
  assert.deepEqual(await lina(), ['Bonjour,\nVilla : 5 déc, 20 janv, 10 févr']);
  // 5 déc passes: the top-up now reaches 1 mars, the only new thing she hears.
  assert.equal(await dailyPlannings('u1', paris('2026-12-07', '08:10'), 'dry_run', null), 1);
  assert.equal((await lina()).at(-1), 'Bonjour,\nVilla : 1 mars ajouté');
});
