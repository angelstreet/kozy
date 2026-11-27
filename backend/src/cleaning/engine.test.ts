import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// A throwaway SQLite file: db.ts reads the URL when first imported, so set it before the dynamic imports.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kozy-engine-test-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.ENCRYPTION_KEY ??= '0'.repeat(64);
const { default: db, initDB } = await import('../db.js');
const { migrateCleaning } = await import('../migrations/add_cleaning.js');
const { sendPlannings } = await import('./engine.js');

await initDB();
await db.execute('ALTER TABLE property ADD COLUMN user_id TEXT');
await migrateCleaning();
await migrateCleaning(); // idempotent

const SUNDAY_19H = new Date('2026-11-29T18:30:00Z'); // Sunday 29 nov, 19:30 Paris
const plannings = async () => (await db.execute(
  "SELECT cleaner_id, body FROM cleaner_message WHERE kind = 'planning' ORDER BY cleaner_id, id",
)).rows.map((r: any) => [Number(r.cleaner_id), String(r.body)]);

test('weekly gate is per cleaner: two cleaners of one owner each get their Sunday planning, once', async () => {
  await db.execute("INSERT INTO property (id, name, user_id, cleaning_label) VALUES (1, 'Haut', 'u1', 'Haut'), (2, 'Bas', 'u1', 'Bas')");
  await db.execute("INSERT INTO cleaner (id, name, phone) VALUES (5, 'Ester', '+33600000005'), (6, 'Christelle', '+33600000006')");
  await db.execute(`INSERT INTO cleaning_task (property_id, date, status, assigned_to) VALUES
    (1, '2026-12-02', 'pending', 5), (1, '2026-12-14', 'pending', 5), (1, '2026-12-20', 'pending', 5),
    (2, '2026-11-30', 'pending', 6), (2, '2026-12-04', 'pending', 6), (2, '2026-12-08', 'pending', 6)`);
  // Christelle already got this week's planning (e.g. an earlier tick): Ester must still get hers.
  await db.execute("UPDATE cleaner SET planning_week_sent = '2026-11-29' WHERE id = 6");
  assert.equal(await sendPlannings('u1', SUNDAY_19H, 'dry_run', null), 1);
  assert.deepEqual(await plannings(), [[5, 'Bonjour,\nHaut : 2, 14, 20 déc']]);

  // Christelle not stamped yet: the next tick sends hers, then both are stamped and nothing more is sent.
  await db.execute("UPDATE cleaner SET planning_week_sent = NULL WHERE id = 6");
  assert.equal(await sendPlannings('u1', new Date('2026-11-29T18:40:00Z'), 'dry_run', null), 1);
  assert.equal(await sendPlannings('u1', new Date('2026-11-29T18:50:00Z'), 'dry_run', null), 0);
  assert.deepEqual((await plannings()).map(([id]) => id), [5, 6]);
  const stamps = (await db.execute('SELECT id, planning_week_sent FROM cleaner ORDER BY id')).rows.map((r: any) => [Number(r.id), r.planning_week_sent]);
  assert.deepEqual(stamps, [[5, '2026-11-29'], [6, '2026-11-29']]);

  // The owner's "send now" (planning_due = 'force') bypasses the weekly gate for every cleaner.
  await db.execute("UPDATE cleaner SET planning_due = 'force'");
  assert.equal(await sendPlannings('u1', new Date('2026-11-29T18:55:00Z'), 'dry_run', null), 2);

  // The following Sunday, both get the new week again, independently.
  assert.equal(await sendPlannings('u1', new Date('2026-12-06T18:30:00Z'), 'dry_run', null), 2);
  assert.deepEqual((await plannings()).map(([id]) => id), [5, 5, 5, 6, 6, 6]);
});
