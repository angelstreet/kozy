import crypto from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import {
  cleanerLink, cleanerSchedule, getCleanerMode, getTestPhone, runCleaning, runCleaningForAll, setCleanerMode, setTestPhone, type CleanerMode,
} from '../cleaning/engine.js';

type Variables = {
  userId: string;
};

const router = new Hono<{ Variables: Variables }>();

/** openclaw (scheduler + WhatsApp sender) authenticates with MESSAGING_CRON_SECRET, not Clerk. */
function hasCronSecret(provided: string | undefined): boolean {
  const secret = process.env.MESSAGING_CRON_SECRET;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const bearer = (h: string | undefined) => h?.replace(/^Bearer /, '');

// --- openclaw endpoints: auth is skipped for /api/cleaning/cron/* in index.ts ---

router.post('/api/cleaning/cron/run', async (c) => {
  if (!hasCronSecret(bearer(c.req.header('Authorization')))) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ results: await runCleaningForAll() });
});

// Messages waiting for WhatsApp. openclaw sends each one, then reports back. A message redirected to the
// owner's test number is headed with the cleaner's name.
router.get('/api/cleaning/cron/outbox', async (c) => {
  if (!hasCronSecret(bearer(c.req.header('Authorization')))) return c.json({ error: 'Unauthorized' }, 401);
  const rows = (await db.execute(`SELECT m.id, m.phone, m.body, cl.name, cl.phone AS cleaner_phone FROM cleaner_message m
    LEFT JOIN cleaner cl ON cl.id = m.cleaner_id WHERE m.status = 'queued' ORDER BY m.id LIMIT 20`)).rows as any[];
  return c.json({ messages: rows.map((r) => ({
    id: r.id, phone: r.phone, body: r.phone !== r.cleaner_phone ? `[${r.name}]\n${r.body}` : r.body,
  })) });
});

router.post('/api/cleaning/cron/outbox/:id', async (c) => {
  if (!hasCronSecret(bearer(c.req.header('Authorization')))) return c.json({ error: 'Unauthorized' }, 401);
  const { status, error } = await c.req.json();
  if (!['sent', 'failed'].includes(status)) return c.json({ error: 'status must be sent or failed' }, 400);
  await db.execute({
    sql: "UPDATE cleaner_message SET status = ?, error = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') END WHERE id = ? AND status = 'queued'",
    args: [status, error ? String(error).slice(0, 300) : null, status, Number(c.req.param('id'))],
  });
  return c.json({ ok: true });
});

// --- Cleaner page (token in the WhatsApp link, no login): /api/s/* skips auth in index.ts ---

router.get('/api/s/:token', async (c) => {
  const schedule = await cleanerSchedule(c.req.param('token'));
  return schedule ? c.json(schedule) : c.json({ error: 'Unknown link' }, 404);
});

// --- Owner endpoints (Clerk) ---

router.get('/api/cleaning/settings', async (c) => {
  const userId = c.get('userId');
  return c.json({ mode: await getCleanerMode(userId), testPhone: await getTestPhone(userId) });
});

// mode: off | dry_run | live. testPhone: while set, live messages go to this number instead of the cleaners'.
router.put('/api/cleaning/settings', async (c) => {
  const userId = c.get('userId');
  const { mode, testPhone } = await c.req.json();
  if (mode !== undefined) {
    if (!['off', 'dry_run', 'live'].includes(mode)) return c.json({ error: 'mode must be off, dry_run or live' }, 400);
    await setCleanerMode(userId, mode as CleanerMode);
  }
  if (testPhone !== undefined) await setTestPhone(userId, testPhone ? String(testPhone).trim() : null);
  return c.json({ mode: await getCleanerMode(userId), testPhone: await getTestPhone(userId) });
});

// How a property appears in cleaners' plannings: label ("Haut") and whether guests are counted ("3(8)").
router.put('/api/cleaning/properties/:id', async (c) => {
  const { label, showGuests } = await c.req.json();
  const res = await db.execute({
    sql: 'UPDATE property SET cleaning_label = ?, cleaning_show_guests = ? WHERE id = ? AND user_id = ?',
    args: [label ? String(label).trim() : null, showGuests ? 1 : 0, Number(c.req.param('id')), c.get('userId')],
  });
  return Number(res.rowsAffected) ? c.json({ ok: true }) : c.json({ error: 'Property not found' }, 404);
});

router.post('/api/cleaning/run', async (c) => c.json(await runCleaning(c.get('userId'))));

router.get('/api/cleaning/messages', async (c) => {
  const rows = (await db.execute({
    sql: `SELECT m.id, m.kind, m.status, m.body, m.error, m.created_at, m.sent_at, cl.name AS cleaner_name
          FROM cleaner_message m LEFT JOIN cleaner cl ON cl.id = m.cleaner_id
          WHERE m.user_id = ? ORDER BY m.id DESC LIMIT 50`,
    args: [c.get('userId')],
  })).rows;
  return c.json({ messages: rows });
});

router.get('/api/cleaning/link/:cleanerId', async (c) => c.json({ url: await cleanerLink(Number(c.req.param('cleanerId'))) }));

export default router;
