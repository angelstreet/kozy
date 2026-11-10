import crypto from 'crypto';
import { Hono } from 'hono';
import db from '../db.js';
import {
  cleanerCredit, cleanerLink, cleanerSchedule, ownsCleaner, parisClock, getCleanerMode, getTestPhone, runCleaning, runCleaningForAll, setCleanerMode, setTestPhone, type CleanerMode,
} from '../cleaning/engine.js';
import {
  REPORT_TYPES, STOCK_LEVELS, createReport, ensureChecklist, finishTask, loadPhoto, propertyAccess, savePhoto, setStep, setStock, stockFor,
  stockItems,
  taskAccess, taskDetail,
} from '../cleaning/visit.js';

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
    id: r.id, phone: r.phone, body: r.name && r.phone !== r.cleaner_phone ? `[${r.name}]\n${r.body}` : r.body,
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

// --- The cleaning itself (Clerk; owner of the property or its cleaner) ---

const deny = (c: any) => c.json({ error: 'Not found' }, 404);

router.get('/api/visit/tasks/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!(await taskAccess(c.get('userId'), id))) return deny(c);
  return c.json(await taskDetail(id));
});

router.put('/api/visit/tasks/:id/steps/:stepId', async (c) => {
  const id = Number(c.req.param('id'));
  const acc = await taskAccess(c.get('userId'), id);
  if (!acc) return deny(c);
  const step = (await db.execute({ sql: 'SELECT property_id FROM checklist_step WHERE id = ?', args: [Number(c.req.param('stepId'))] })).rows[0] as any;
  if (!step || Number(step.property_id) !== acc.propertyId) return deny(c);
  const { done, photoId } = await c.req.json();
  await setStep(id, Number(c.req.param('stepId')), Boolean(done), photoId == null ? null : Number(photoId));
  return c.json(await taskDetail(id));
});

router.post('/api/visit/tasks/:id/finish', async (c) => {
  const id = Number(c.req.param('id'));
  if (!(await taskAccess(c.get('userId'), id))) return deny(c);
  const { note } = await c.req.json().catch(() => ({}));
  await finishTask(id, note ? String(note).slice(0, 1000) : null);
  return c.json(await taskDetail(id));
});

router.post('/api/visit/photos', async (c) => {
  const { propertyId, taskId, data } = await c.req.json();
  if (!(await propertyAccess(c.get('userId'), Number(propertyId)))) return deny(c);
  try {
    return c.json({ id: await savePhoto(Number(propertyId), taskId ? Number(taskId) : null, String(data)) }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

router.get('/api/visit/photos/:id', async (c) => {
  const photo = await loadPhoto(Number(c.req.param('id')));
  if (!photo || !(await propertyAccess(c.get('userId'), Number(photo.propertyId)))) return deny(c);
  return new Response(Buffer.from(String(photo.data), 'base64'), {
    headers: { 'Content-Type': String(photo.mime), 'Cache-Control': 'private, max-age=86400' },
  });
});

router.post('/api/visit/reports', async (c) => {
  const { propertyId, taskId, type, what, note, photoId } = await c.req.json();
  const acc = await propertyAccess(c.get('userId'), Number(propertyId));
  if (!acc) return deny(c);
  if (!(REPORT_TYPES as readonly string[]).includes(type) || !what) return c.json({ error: 'type and what required' }, 400);
  if (taskId && !(await taskAccess(c.get('userId'), Number(taskId)))) return deny(c);
  const id = await createReport({ propertyId: Number(propertyId), taskId: taskId ? Number(taskId) : null, cleanerId: acc.cleanerId,
    type, what: String(what).slice(0, 200), note: note ? String(note).slice(0, 1000) : null, photoId: photoId ? Number(photoId) : null });
  return c.json({ id }, 201);
});

// Stock: the properties the user cleans (cleaner) or owns (owner), with each product's level.
router.get('/api/visit/stock', async (c) => {
  const userId = c.get('userId');
  const props = (await db.execute({
    sql: `SELECT DISTINCT p.id, COALESCE(p.cleaning_label, p.name) AS label FROM property p
          LEFT JOIN property_cleaner pc ON pc.property_id = p.id LEFT JOIN cleaner cl ON cl.id = pc.cleaner_id
          WHERE ? OR p.user_id = ? OR cl.clerk_user_id = ? ORDER BY p.id`,
    args: [userId === 'dev-user' ? 1 : 0, userId, userId],
  })).rows as any[];
  return c.json({ properties: await Promise.all(props.map(async (p) => ({ id: Number(p.id), label: p.label, items: await stockFor(Number(p.id)) }))) });
});

router.put('/api/visit/stock/:propertyId', async (c) => {
  const acc = await propertyAccess(c.get('userId'), Number(c.req.param('propertyId')));
  if (!acc) return deny(c);
  const { item, level } = await c.req.json();
  if (!item || !(STOCK_LEVELS as readonly string[]).includes(level)) return c.json({ error: 'item and level (ok|low|out) required' }, 400);
  await setStock(Number(c.req.param('propertyId')), String(item).slice(0, 80), level, acc.cleanerId);
  return c.json({ ok: true });
});

// --- Checklist editor (owner of the property) ---

async function ownerOf(c: any, propertyId: number) {
  return (await propertyAccess(c.get('userId'), propertyId))?.owner === true;
}
async function stepProperty(stepId: number): Promise<number | null> {
  const r = (await db.execute({ sql: 'SELECT property_id FROM checklist_step WHERE id = ? AND active = 1', args: [stepId] })).rows[0] as any;
  return r ? Number(r.property_id) : null;
}

router.get('/api/checklist/:propertyId', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  await ensureChecklist(pid);
  const steps = (await db.execute({
    sql: `SELECT id, room, label, needs_photo AS needsPhoto, ref_photo_id AS refPhotoId, position FROM checklist_step
          WHERE property_id = ? AND active = 1 ORDER BY position, id`,
    args: [pid],
  })).rows.map((s: any) => ({ ...s, needsPhoto: Boolean(s.needsPhoto) }));
  return c.json({ steps, stock: await stockItems(pid) });
});

router.post('/api/checklist/:propertyId/steps', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  const { room, label, needsPhoto } = await c.req.json();
  if (!room || !label) return c.json({ error: 'room and label required' }, 400);
  const max = Number(((await db.execute({ sql: 'SELECT COALESCE(MAX(position), 0) AS m FROM checklist_step WHERE property_id = ?', args: [pid] })).rows[0] as any).m);
  const res = await db.execute({
    sql: 'INSERT INTO checklist_step (property_id, room, label, needs_photo, position) VALUES (?, ?, ?, ?, ?)',
    args: [pid, String(room).trim().slice(0, 60), String(label).trim().slice(0, 160), needsPhoto ? 1 : 0, max + 1],
  });
  return c.json({ id: Number(res.lastInsertRowid) }, 201);
});

// Edit one step: label, room, photo needed, reference photo (null removes it).
router.patch('/api/checklist/steps/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const pid = await stepProperty(id);
  if (!pid || !(await ownerOf(c, pid))) return deny(c);
  const b = await c.req.json();
  const sets: string[] = [], args: any[] = [];
  if (b.label !== undefined) { sets.push('label = ?'); args.push(String(b.label).trim().slice(0, 160)); }
  if (b.room !== undefined) { sets.push('room = ?'); args.push(String(b.room).trim().slice(0, 60)); }
  if (b.needsPhoto !== undefined) { sets.push('needs_photo = ?'); args.push(b.needsPhoto ? 1 : 0); }
  if (b.refPhotoId !== undefined) { sets.push('ref_photo_id = ?'); args.push(b.refPhotoId == null ? null : Number(b.refPhotoId)); }
  if (!sets.length) return c.json({ error: 'nothing to change' }, 400);
  await db.execute({ sql: `UPDATE checklist_step SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
  return c.json({ ok: true });
});

// Removed steps stay in the DB (inactive) so past cleanings keep their history.
router.delete('/api/checklist/steps/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const pid = await stepProperty(id);
  if (!pid || !(await ownerOf(c, pid))) return deny(c);
  await db.execute({ sql: 'UPDATE checklist_step SET active = 0 WHERE id = ?', args: [id] });
  return c.json({ ok: true });
});

// Rename a room: every active step in it.
router.put('/api/checklist/:propertyId/rooms', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  const { from, to } = await c.req.json();
  if (!from || !to) return c.json({ error: 'from and to required' }, 400);
  await db.execute({ sql: 'UPDATE checklist_step SET room = ? WHERE property_id = ? AND room = ? AND active = 1', args: [String(to).trim().slice(0, 60), pid, from] });
  return c.json({ ok: true });
});

// New order of the property's steps (rooms follow their first step): {ids: [...]}.
router.put('/api/checklist/:propertyId/order', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) return c.json({ error: 'ids required' }, 400);
  for (const [i, id] of ids.entries()) {
    await db.execute({ sql: 'UPDATE checklist_step SET position = ? WHERE id = ? AND property_id = ?', args: [i, Number(id), pid] });
  }
  return c.json({ ok: true });
});

router.post('/api/checklist/:propertyId/stock', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  const { item } = await c.req.json();
  if (!item || !String(item).trim()) return c.json({ error: 'item required' }, 400);
  const items = await stockItems(pid);
  await db.execute({ sql: 'INSERT OR IGNORE INTO stock_item (property_id, item, position) VALUES (?, ?, ?)', args: [pid, String(item).trim().slice(0, 80), items.length] });
  return c.json({ ok: true }, 201);
});

router.delete('/api/checklist/:propertyId/stock', async (c) => {
  const pid = Number(c.req.param('propertyId'));
  if (!(await ownerOf(c, pid))) return deny(c);
  const item = c.req.query('item');
  if (!item) return c.json({ error: 'item required' }, 400);
  await stockItems(pid); // seed first, so removing a default is remembered
  await db.execute({ sql: 'DELETE FROM stock_item WHERE property_id = ? AND item = ?', args: [pid, item] });
  await db.execute({ sql: 'DELETE FROM stock_level WHERE property_id = ? AND item = ?', args: [pid, item] });
  return c.json({ ok: true });
});

// --- Owner endpoints (Clerk) ---

// Recent cleanings, open reports and the shopping list (stock low or out) across the owner's properties.
router.get('/api/cleaning/activity', async (c) => {
  const userId = c.get('userId');
  const today = parisClock(new Date()).date;
  const recent = (await db.execute({
    sql: `SELECT ct.id, ct.date, ct.status, ct.started_at AS startedAt, ct.finished_at AS finishedAt, COALESCE(p.cleaning_label, p.name) AS label,
            p.name AS property, cl.name AS cleaner,
            (SELECT COUNT(*) FROM cleaning_report r WHERE r.task_id = ct.id) AS reports
          FROM cleaning_task ct JOIN property p ON p.id = ct.property_id LEFT JOIN cleaner cl ON cl.id = ct.assigned_to
          WHERE p.user_id = ? AND ct.date <= ? AND (ct.started_at IS NOT NULL OR ct.date >= date(?, '-14 day'))
          ORDER BY ct.date DESC LIMIT 12`,
    args: [userId, today, today],
  })).rows;
  const reports = (await db.execute({
    sql: `SELECT r.id, r.type, r.what, r.note, r.photo_id AS photoId, r.task_id AS taskId, r.created_at AS createdAt, p.name AS property, cl.name AS cleaner
          FROM cleaning_report r JOIN property p ON p.id = r.property_id LEFT JOIN cleaner cl ON cl.id = r.cleaner_id
          WHERE p.user_id = ? AND r.status = 'open' ORDER BY r.id DESC`,
    args: [userId],
  })).rows;
  const shopping = (await db.execute({
    sql: `SELECT p.name AS property, s.item, s.level FROM stock_level s JOIN property p ON p.id = s.property_id
          WHERE p.user_id = ? AND s.level != 'ok' ORDER BY p.id, s.item`,
    args: [userId],
  })).rows;
  return c.json({ today, recent, reports, shopping });
});

router.patch('/api/cleaning/reports/:id', async (c) => {
  const r = (await db.execute({ sql: 'SELECT property_id FROM cleaning_report WHERE id = ?', args: [Number(c.req.param('id'))] })).rows[0] as any;
  const acc = r ? await propertyAccess(c.get('userId'), Number(r.property_id)) : null;
  if (!acc?.owner) return deny(c);
  const { status } = await c.req.json();
  if (!['open', 'resolved'].includes(status)) return c.json({ error: 'status must be open or resolved' }, 400);
  await db.execute({ sql: "UPDATE cleaning_report SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') END WHERE id = ?",
    args: [status, status, Number(c.req.param('id'))] });
  return c.json({ ok: true });
});


async function ownerPhone(userId: string): Promise<string | null> {
  const row = (await db.execute({ sql: "SELECT value FROM user_settings WHERE user_id = ? AND key = 'owner_phone'", args: [userId] })).rows[0] as any;
  return row?.value || null;
}

router.get('/api/cleaning/settings', async (c) => {
  const userId = c.get('userId');
  return c.json({ mode: await getCleanerMode(userId), testPhone: await getTestPhone(userId), ownerPhone: await ownerPhone(userId) });
});

// mode: off | dry_run | live. testPhone: while set, live messages go to this number instead of the cleaners'.
router.put('/api/cleaning/settings', async (c) => {
  const userId = c.get('userId');
  const { mode, testPhone, ownerPhone: own } = await c.req.json();
  if (mode !== undefined) {
    if (!['off', 'dry_run', 'live'].includes(mode)) return c.json({ error: 'mode must be off, dry_run or live' }, 400);
    await setCleanerMode(userId, mode as CleanerMode);
  }
  if (testPhone !== undefined) await setTestPhone(userId, testPhone ? String(testPhone).trim() : null);
  if (own !== undefined) {
    await db.execute({
      sql: `INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, 'owner_phone', ?, datetime('now'))
            ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [userId, own ? String(own).trim() : null],
    });
  }
  return c.json({ mode: await getCleanerMode(userId), testPhone: await getTestPhone(userId), ownerPhone: await ownerPhone(userId) });
});

// How a property appears to cleaners: planning label ("Haut"), guest counts ("3(8)"), reminder place ("à la villa").
router.put('/api/cleaning/properties/:id', async (c) => {
  const { label, showGuests, place } = await c.req.json();
  const sets: string[] = [], args: any[] = [];
  if (label !== undefined) { sets.push('cleaning_label = ?'); args.push(label ? String(label).trim() : null); }
  if (showGuests !== undefined) { sets.push('cleaning_show_guests = ?'); args.push(showGuests ? 1 : 0); }
  if (place !== undefined) { sets.push('cleaning_place = ?'); args.push(place ? String(place).trim() : null); }
  if (!sets.length) return c.json({ error: 'nothing to change' }, 400);
  const res = await db.execute({
    sql: `UPDATE property SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, args: [...args, Number(c.req.param('id')), c.get('userId')],
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
