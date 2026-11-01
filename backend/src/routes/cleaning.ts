import crypto from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import { cleanerLink, cleanerSchedule, getCleanerMode, runCleaning, runCleaningForAll, setCleanerMode, type CleanerMode } from '../cleaning/engine.js';

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

// Messages waiting for WhatsApp. openclaw sends each one, then reports back.
router.get('/api/cleaning/cron/outbox', async (c) => {
  if (!hasCronSecret(bearer(c.req.header('Authorization')))) return c.json({ error: 'Unauthorized' }, 401);
  const rows = (await db.execute("SELECT id, phone, body FROM cleaner_message WHERE status = 'queued' ORDER BY id LIMIT 20")).rows;
  return c.json({ messages: rows });
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

router.get('/api/cleaning/settings', async (c) => c.json({ mode: await getCleanerMode(c.get('userId')) }));

router.put('/api/cleaning/settings', async (c) => {
  const { mode } = await c.req.json();
  if (!['off', 'dry_run', 'live'].includes(mode)) return c.json({ error: 'mode must be off, dry_run or live' }, 400);
  await setCleanerMode(c.get('userId'), mode as CleanerMode);
  return c.json({ mode });
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
