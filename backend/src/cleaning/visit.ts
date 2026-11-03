/**
 * The cleaning itself, as the cleaner does it in the app: checklist per property (rooms → steps, some needing a
 * photo), ticked per task, photos, reports (missing / broken / product / guest damage), stock levels, finish.
 * The owner gets a WhatsApp note for each report and each finished cleaning (outbox, like the plannings).
 */
import db from '../db.js';
import { getTestPhone, parisClock } from './engine.js';

export const REPORT_TYPES = ['missing', 'broken', 'product', 'damage'] as const;
export const STOCK_LEVELS = ['ok', 'low', 'out'] as const;

/** Default checklist, copied to a property the first time one of its cleanings is opened; the owner edits it later. */
const DEFAULT_CHECKLIST: [string, string, boolean][] = [
  ['Chambre', 'Draps et housses changés', false],
  ['Chambre', 'Lit fait, serviettes posées (2 par personne)', true],
  ['Chambre', 'Sol aspiré et lavé', false],
  ['Salle de bain', 'Douche et lavabo nettoyés', true],
  ['Salle de bain', 'WC nettoyés', false],
  ['Salle de bain', '2 serviettes de réserve dans le placard', false],
  ['Salle de bain', 'Papier toilette : 2 rouleaux', false],
  ['Cuisine', 'Vaisselle propre et rangée', false],
  ['Cuisine', 'Plan de travail et plaques', true],
  ['Cuisine', 'Frigo vidé et propre', false],
  ['Cuisine', 'Poubelles vidées, sac neuf', false],
  ['Séjour', 'Surfaces dépoussiérées', false],
  ['Séjour', 'Canapé et coussins en place', true],
  ['Séjour', 'Sol aspiré et lavé', false],
  ['Départ', 'Fenêtres fermées, chauffage réglé', false],
  ['Départ', 'Clés à leur place', true],
];

export const DEFAULT_STOCK = [
  'Papier toilette', 'Savon et gel douche', 'Café et thé', 'Liquide vaisselle', 'Éponges', 'Sacs poubelle',
  'Produits ménage', 'Jeux de draps et serviettes',
];

/** Who may see / act on a property: its owner, or a cleaner assigned to it. 'dev-user' (local) sees all. */
export async function propertyAccess(userId: string, propertyId: number): Promise<{ owner: boolean; cleanerId: number | null } | null> {
  if (userId === 'dev-user') return { owner: true, cleanerId: null };
  const p = (await db.execute({ sql: 'SELECT user_id FROM property WHERE id = ?', args: [propertyId] })).rows[0] as any;
  if (!p) return null;
  if (p.user_id === userId) return { owner: true, cleanerId: null };
  const cl = (await db.execute({
    sql: `SELECT c.id FROM cleaner c JOIN property_cleaner pc ON pc.cleaner_id = c.id WHERE c.clerk_user_id = ? AND pc.property_id = ?`,
    args: [userId, propertyId],
  })).rows[0] as any;
  return cl ? { owner: false, cleanerId: Number(cl.id) } : null;
}

/** A task the user may open: the owner of its property, or the cleaner it is assigned to. */
export async function taskAccess(userId: string, taskId: number) {
  const t = (await db.execute({ sql: 'SELECT id, property_id, assigned_to FROM cleaning_task WHERE id = ?', args: [taskId] })).rows[0] as any;
  if (!t) return null;
  const acc = await propertyAccess(userId, Number(t.property_id));
  if (!acc) return null;
  if (!acc.owner && Number(t.assigned_to) !== acc.cleanerId) return null;
  return { ...acc, propertyId: Number(t.property_id) };
}

async function ensureChecklist(propertyId: number) {
  const n = Number(((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM checklist_step WHERE property_id = ?', args: [propertyId] })).rows[0] as any).n);
  if (n) return;
  for (const [i, [room, label, photo]] of DEFAULT_CHECKLIST.entries()) {
    await db.execute({
      sql: 'INSERT INTO checklist_step (property_id, room, label, needs_photo, position) VALUES (?, ?, ?, ?, ?)',
      args: [propertyId, room, label, photo ? 1 : 0, i],
    });
  }
}

/** Everything the cleaning screen needs: the task, its checklist grouped by room with what is done, its reports. */
export async function taskDetail(taskId: number) {
  const t = (await db.execute({
    sql: `SELECT ct.id, ct.date, ct.status, ct.property_id AS propertyId, p.name AS property, COALESCE(p.cleaning_label, p.name) AS label,
            p.address, COALESCE(ct.start_time, p.checkout_time, '12:00') AS start, ct.next_arrival AS nextArrival,
            ct.next_checkin AS nextCheckIn, ct.next_guests AS nextGuests, ct.started_at AS startedAt, ct.finished_at AS finishedAt,
            ct.finish_note AS finishNote, cl.name AS cleaner
          FROM cleaning_task ct JOIN property p ON p.id = ct.property_id LEFT JOIN cleaner cl ON cl.id = ct.assigned_to
          WHERE ct.id = ?`,
    args: [taskId],
  })).rows[0] as any;
  await ensureChecklist(Number(t.propertyId));
  const steps = (await db.execute({
    sql: `SELECT s.id, s.room, s.label, s.needs_photo AS needsPhoto, s.ref_photo_id AS refPhotoId, ts.done_at AS doneAt, ts.photo_id AS photoId
          FROM checklist_step s LEFT JOIN task_step ts ON ts.step_id = s.id AND ts.task_id = ?
          WHERE s.property_id = ? AND s.active = 1 ORDER BY s.position, s.id`,
    args: [taskId, t.propertyId],
  })).rows as any[];
  const rooms: { room: string; steps: any[] }[] = [];
  for (const s of steps) {
    let r = rooms.find((x) => x.room === s.room);
    if (!r) rooms.push(r = { room: s.room, steps: [] });
    r.steps.push({ id: Number(s.id), label: s.label, needsPhoto: Boolean(s.needsPhoto), refPhotoId: s.refPhotoId ?? null,
      done: Boolean(s.doneAt), photoId: s.photoId ?? null });
  }
  const reports = (await db.execute({
    sql: `SELECT id, type, what, note, photo_id AS photoId, status, created_at AS createdAt FROM cleaning_report WHERE task_id = ? ORDER BY id`,
    args: [taskId],
  })).rows;
  const all = rooms.flatMap((r) => r.steps);
  return {
    task: t, rooms, reports,
    progress: {
      done: all.filter((s) => s.done).length, total: all.length,
      photos: all.filter((s) => s.needsPhoto && s.photoId).length, photosNeeded: all.filter((s) => s.needsPhoto).length,
    },
  };
}

export async function setStep(taskId: number, stepId: number, done: boolean, photoId: number | null | undefined) {
  if (done || photoId) {
    await db.execute({
      sql: `INSERT INTO task_step (task_id, step_id, done_at, photo_id) VALUES (?, ?, ?, ?)
            ON CONFLICT(task_id, step_id) DO UPDATE SET done_at = excluded.done_at, photo_id = COALESCE(excluded.photo_id, task_step.photo_id)`,
      args: [taskId, stepId, done ? new Date().toISOString() : null, photoId ?? null],
    });
  } else {
    await db.execute({ sql: 'UPDATE task_step SET done_at = NULL WHERE task_id = ? AND step_id = ?', args: [taskId, stepId] });
  }
  await db.execute({ sql: "UPDATE cleaning_task SET started_at = COALESCE(started_at, ?), status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END WHERE id = ?",
    args: [new Date().toISOString(), taskId] });
}

/** WhatsApp note to the owner: their own number setting, else the test number (which is theirs while testing). */
async function notifyOwner(ownerId: string, cleanerId: number | null, kind: string, body: string) {
  const own = (await db.execute({ sql: "SELECT value FROM user_settings WHERE user_id = ? AND key = 'owner_phone'", args: [ownerId] })).rows[0] as any;
  const phone = own?.value || await getTestPhone(ownerId);
  if (!phone) return;
  await db.execute({
    sql: `INSERT INTO cleaner_message (user_id, cleaner_id, kind, dedupe_key, phone, body, status) VALUES (?, ?, ?, ?, ?, ?, 'queued')`,
    args: [ownerId, cleanerId ?? 0, kind, `owner:${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, phone, body],
  });
}

const TYPE_FR: Record<string, string> = { missing: 'Il manque', broken: 'Cassé', product: 'Produit à racheter', damage: 'Dégât voyageur' };

export async function createReport(r: { propertyId: number; taskId: number | null; cleanerId: number | null; type: string; what: string; note: string | null; photoId: number | null }) {
  const res = await db.execute({
    sql: 'INSERT INTO cleaning_report (property_id, task_id, cleaner_id, type, what, note, photo_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [r.propertyId, r.taskId, r.cleanerId, r.type, r.what, r.note, r.photoId],
  });
  const p = (await db.execute({ sql: 'SELECT user_id, COALESCE(cleaning_label, name) AS label FROM property WHERE id = ?', args: [r.propertyId] })).rows[0] as any;
  await notifyOwner(String(p.user_id), r.cleanerId, 'owner_report',
    `Signalé · ${p.label}\n${TYPE_FR[r.type] ?? r.type} : ${r.what}${r.note ? `\n${r.note}` : ''}${r.photoId ? '\n(photo dans Kozy)' : ''}`);
  return Number(res.lastInsertRowid);
}

export async function finishTask(taskId: number, note: string | null) {
  const now = new Date();
  await db.execute({
    sql: "UPDATE cleaning_task SET status = 'done', finished_at = ?, finish_note = ?, started_at = COALESCE(started_at, ?) WHERE id = ?",
    args: [now.toISOString(), note, now.toISOString(), taskId],
  });
  const d = await taskDetail(taskId);
  const p = (await db.execute({ sql: 'SELECT user_id FROM property WHERE id = ?', args: [d.task.propertyId] })).rows[0] as any;
  const at = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(now).replace(':', 'h');
  const open = d.reports.length;
  const cl = (await db.execute({ sql: 'SELECT assigned_to FROM cleaning_task WHERE id = ?', args: [taskId] })).rows[0] as any;
  await notifyOwner(String(p.user_id), cl?.assigned_to ?? null, 'owner_done',
    `Ménage fini · ${d.task.label} · ${at}\n${d.progress.done}/${d.progress.total} étapes, ${d.progress.photos} photo${d.progress.photos > 1 ? 's' : ''}`
    + (open ? `, ${open} signalement${open > 1 ? 's' : ''}` : '') + (note ? `\n« ${note} »` : ''));
}

export async function stockFor(propertyId: number) {
  const rows = (await db.execute({ sql: 'SELECT item, level, updated_at AS updatedAt FROM stock_level WHERE property_id = ?', args: [propertyId] })).rows as any[];
  const known = new Map(rows.map((r) => [String(r.item), r]));
  const items = [...DEFAULT_STOCK, ...rows.map((r) => String(r.item)).filter((i) => !DEFAULT_STOCK.includes(i))];
  return items.map((item) => ({ item, level: known.get(item)?.level ?? 'ok', updatedAt: known.get(item)?.updatedAt ?? null }));
}

export async function setStock(propertyId: number, item: string, level: string, cleanerId: number | null) {
  await db.execute({
    sql: `INSERT INTO stock_level (property_id, item, level, cleaner_id, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(property_id, item) DO UPDATE SET level = excluded.level, cleaner_id = excluded.cleaner_id, updated_at = excluded.updated_at`,
    args: [propertyId, item, level, cleanerId],
  });
}

export async function savePhoto(propertyId: number, taskId: number | null, dataUrl: string): Promise<number> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('photo must be a base64 JPEG, PNG or WebP data URL');
  if (m[2].length > 1_500_000) throw new Error('photo too large');
  const res = await db.execute({
    sql: 'INSERT INTO cleaning_photo (property_id, task_id, mime, data) VALUES (?, ?, ?, ?)', args: [propertyId, taskId, m[1], m[2]],
  });
  return Number(res.lastInsertRowid);
}

export async function loadPhoto(id: number) {
  return (await db.execute({ sql: 'SELECT property_id AS propertyId, mime, data FROM cleaning_photo WHERE id = ?', args: [id] })).rows[0] as any;
}

export { parisClock };
