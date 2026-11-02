import crypto from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import {
  cleanerCredit, cleanerLink, cleanerSchedule, ownsCleaner, parisClock, getCleanerMode, getTestPhone, runCleaning, runCleaningForAll, setCleanerMode, setTestPhone, type CleanerMode,
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

// Owner run. {"sendNow":true} sends every cleaner their current planning on this run.
router.post('/api/cleaning/run', async (c) => {
  const userId = c.get('userId');
  const { sendNow } = await c.req.json().catch(() => ({}));
  if (sendNow) {
    await db.execute({
      sql: `UPDATE cleaner SET planning_due = 'force' WHERE id IN (SELECT pc.cleaner_id FROM property_cleaner pc
            JOIN property p ON p.id = pc.property_id WHERE p.user_id = ?)`,
      args: [userId],
    });
  }
  return c.json(await runCleaning(userId));
});

router.get('/api/cleaning/messages', async (c) => {
  const rows = (await db.execute({
    sql: `SELECT m.id, m.kind, m.status, m.body, m.error, m.created_at, m.sent_at, cl.name AS cleaner_name
          FROM cleaner_message m LEFT JOIN cleaner cl ON cl.id = m.cleaner_id
          WHERE m.user_id = ? ORDER BY m.id DESC LIMIT 50`,
    args: [c.get('userId')],
  })).rows;
  return c.json({ messages: rows });
});

// Prepaid packs. PUT sets the count as of today ({"paid":12,"used":9}); null paid = paid per cleaning.
// POST .../pack adds a paid pack ({"units":6}).
router.get('/api/cleaning/credits', async (c) => {
  const userId = c.get('userId');
  const rows = (await db.execute({
    sql: `SELECT DISTINCT cl.id, cl.name, cl.credit_paid FROM cleaner cl JOIN property_cleaner pc ON pc.cleaner_id = cl.id
          JOIN property p ON p.id = pc.property_id WHERE p.user_id = ? ORDER BY cl.name`,
    args: [userId],
  })).rows as any[];
  const today = parisClock(new Date()).date;
  return c.json({ cleaners: await Promise.all(rows.map(async (r) => ({
    id: Number(r.id), name: r.name, counter: await cleanerCredit(userId, Number(r.id), today),
  }))) });
});

router.use('/api/cleaning/credits/:cleanerId/*', async (c, next) =>
  (await ownsCleaner(c.get('userId'), Number(c.req.param('cleanerId')))) ? next() : c.json({ error: 'Not found' }, 404));
router.use('/api/cleaning/credits/:cleanerId', async (c, next) =>
  (await ownsCleaner(c.get('userId'), Number(c.req.param('cleanerId')))) ? next() : c.json({ error: 'Not found' }, 404));
router.use('/api/cleaning/link/:cleanerId', async (c, next) =>
  (await ownsCleaner(c.get('userId'), Number(c.req.param('cleanerId')))) ? next() : c.json({ error: 'Not found' }, 404));

router.use('/api/cleaning/invite/:cleanerId', async (c, next) =>
  (await ownsCleaner(c.get('userId'), Number(c.req.param('cleanerId')))) ? next() : c.json({ error: 'Not found' }, 404));

// Sends the cleaner her account invite by WhatsApp (to the test number while one is set).
router.post('/api/cleaning/invite/:cleanerId', async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('cleanerId'));
  const cl = (await db.execute({ sql: 'SELECT id, name, phone, language, invite_token FROM cleaner WHERE id = ?', args: [id] })).rows[0] as any;
  let token = cl.invite_token as string | null;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await db.execute({ sql: "UPDATE cleaner SET invite_token = ?, invite_method = 'whatsapp' WHERE id = ?", args: [token, id] });
  }
  const mode = await getCleanerMode(userId);
  if (mode === 'off') return c.json({ error: 'WhatsApp messages are off' }, 400);
  const phone = (await getTestPhone(userId)) || cl.phone;
  const url = `${process.env.KOZY_APP_URL || 'https://kozy-steel.vercel.app'}/invite/${token}`;
  const body = (cl.language || 'fr').startsWith('en')
    ? `Hello ${cl.name},\nHere is your Kozy access to see your cleanings: ${url}`
    : `Bonjour ${cl.name},\nVoici votre accès Kozy pour voir vos ménages : ${url}`;
  const status = mode === 'dry_run' ? 'dry_run' : phone ? 'queued' : 'no_phone';
  await db.execute({
    sql: `INSERT INTO cleaner_message (user_id, cleaner_id, kind, dedupe_key, phone, body, status) VALUES (?, ?, 'invite', ?, ?, ?, ?)`,
    args: [userId, id, `${mode}:invite:${id}:${Date.now()}`, phone, body, status],
  });
  await db.execute({ sql: 'UPDATE cleaner SET invite_sent_at = ? WHERE id = ?', args: [new Date().toISOString(), id] });
  return c.json({ ok: true, status, url });
});

router.put('/api/cleaning/credits/:cleanerId', async (c) => {
  const { paid, used } = await c.req.json();
  await db.execute({
    sql: 'UPDATE cleaner SET credit_paid = ?, credit_used = ?, credit_as_of = ? WHERE id = ?',
    args: [paid == null ? null : Number(paid), paid == null ? null : Number(used) || 0, parisClock(new Date()).date, Number(c.req.param('cleanerId'))],
  });
  return c.json({ counter: await cleanerCredit(c.get('userId'), Number(c.req.param('cleanerId')), parisClock(new Date()).date) });
});

router.post('/api/cleaning/credits/:cleanerId/pack', async (c) => {
  const { units } = await c.req.json().catch(() => ({}));
  await db.execute({
    sql: 'UPDATE cleaner SET credit_paid = COALESCE(credit_paid, 0) + ?, credit_used = COALESCE(credit_used, 0), credit_as_of = COALESCE(credit_as_of, ?) WHERE id = ?',
    args: [Number(units) || 6, parisClock(new Date()).date, Number(c.req.param('cleanerId'))],
  });
  return c.json({ counter: await cleanerCredit(c.get('userId'), Number(c.req.param('cleanerId')), parisClock(new Date()).date) });
});

router.get('/api/cleaning/link/:cleanerId', async (c) => c.json({ url: await cleanerLink(Number(c.req.param('cleanerId'))) }));

export default router;
