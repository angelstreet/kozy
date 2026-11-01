import crypto from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import {
  getSettings, loadPlaceholders, loadTemplates, previewMessages, runMessaging, runMessagingForAll,
  savePlaceholder, saveSettings, type MessagingMode,
} from '../messaging/engine.js';

type Variables = {
  userId: string;
};

const router = new Hono<{ Variables: Variables }>();

/** Scheduler and Smoobu webhook authenticate with MESSAGING_CRON_SECRET, not Clerk. */
function hasCronSecret(provided: string | undefined): boolean {
  const secret = process.env.MESSAGING_CRON_SECRET;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Public (secret) endpoints: auth is skipped for /api/messaging/run and /webhook in index.ts ---

router.post('/api/messaging/run', async (c) => {
  if (!hasCronSecret(c.req.header('Authorization')?.replace(/^Bearer /, ''))) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ results: await runMessagingForAll() });
});

// Smoobu webhook (newReservation, updateReservation, cancelReservation, newMessage, ...).
router.post('/api/messaging/webhook', async (c) => {
  if (!hasCronSecret(c.req.query('token'))) return c.json({ error: 'Unauthorized' }, 401);
  const event = await c.req.json().catch(() => ({}));
  // Runs are idempotent (sent messages are logged), so any booking event can trigger one.
  const results = event?.action === 'newMessage' ? [] : await runMessagingForAll();
  return c.json({ ok: true, action: event?.action ?? null, results });
});

// --- Owner endpoints (Clerk) ---

router.get('/api/messaging/settings', async (c) => c.json(await getSettings(c.get('userId'))));

router.put('/api/messaging/settings', async (c) => {
  const { mode, liveChannels } = await c.req.json();
  if (!['off', 'dry_run', 'live'].includes(mode)) return c.json({ error: 'mode must be off, dry_run or live' }, 400);
  await saveSettings(c.get('userId'), mode as MessagingMode, Array.isArray(liveChannels) ? liveChannels : []);
  return c.json(await getSettings(c.get('userId')));
});

router.get('/api/messaging/templates', async (c) => c.json({ templates: await loadTemplates(c.get('userId')) }));

// Create or replace a template by key.
router.put('/api/messaging/templates/:key', async (c) => {
  const userId = c.get('userId');
  const t = await c.req.json();
  if (!['booking', 'arrival', 'departure'].includes(t.anchor) || !t.body_fr || !t.body_en || !t.name) {
    return c.json({ error: 'name, anchor (booking|arrival|departure), body_fr and body_en are required' }, 400);
  }
  await db.execute({
    sql: `INSERT INTO message_template (user_id, key, name, anchor, offset_days, send_time, subject_fr, subject_en, body_fr, body_en, active, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, key) DO UPDATE SET name = excluded.name, anchor = excluded.anchor, offset_days = excluded.offset_days,
            send_time = excluded.send_time, subject_fr = excluded.subject_fr, subject_en = excluded.subject_en,
            body_fr = excluded.body_fr, body_en = excluded.body_en, active = excluded.active, updated_at = excluded.updated_at`,
    args: [userId, c.req.param('key'), t.name, t.anchor, Number(t.offset_days) || 0, t.send_time || null,
      t.subject_fr || null, t.subject_en || null, t.body_fr, t.body_en, t.active === false ? 0 : 1],
  });
  return c.json({ ok: true });
});

// Placeholder keys per apartment (values stay server-side; they hold door codes).
router.get('/api/messaging/placeholders', async (c) => {
  const ph = await loadPlaceholders(c.get('userId'));
  return c.json({ placeholders: [...ph.entries()].map(([k, v]) => ({ apartment_lang: k, keys: Object.keys(v).sort() })) });
});

// Body: { values: [{ apartment_id, key, lang, value }] }
router.put('/api/messaging/placeholders', async (c) => {
  const { values } = await c.req.json();
  if (!Array.isArray(values)) return c.json({ error: 'values[] required' }, 400);
  for (const v of values) {
    if (!/^k_[a-z_]+$/.test(v.key) || !['fr', 'en'].includes(v.lang) || !v.apartment_id) {
      return c.json({ error: `bad placeholder ${JSON.stringify({ key: v.key, lang: v.lang })}` }, 400);
    }
    await savePlaceholder(c.get('userId'), Number(v.apartment_id), v.key, v.lang, String(v.value ?? ''));
  }
  return c.json({ ok: true, saved: values.length });
});

router.get('/api/messaging/preview', async (c) => {
  const days = Math.min(Number(c.req.query('days')) || 7, 60);
  return c.json(await previewMessages(c.get('userId'), days));
});

// Run now for the signed-in owner (same rules as the scheduler).
router.post('/api/messaging/run-mine', async (c) => c.json(await runMessaging(c.get('userId'))));

router.get('/api/messaging/log', async (c) => {
  const rows = await db.execute({
    sql: `SELECT smoobu_booking_id, template_key, mode, status, channel, apartment_id, guest_name, lang, send_at, error, created_at, body
          FROM message_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [c.get('userId'), Math.min(Number(c.req.query('limit')) || 50, 200)],
  });
  return c.json({ log: rows.rows });
});

export default router;
