import db from '../db.js';
import { decryptApiKey, encryptApiKey } from '../encryption.js';
import { parseSmoobuCredentials, smoobuFetch, type SmoobuCredentials } from '../smoobu-client.js';
import { fetchSmoobuBookings, type SmoobuReservation } from '../smoobu-sync.js';
import {
  isDue, langFor, render, sendAtFor, skipReason,
  type BookingForMessaging, type Lang, type MessageTemplate,
} from './schedule.js';

export type MessagingMode = 'off' | 'dry_run' | 'live';

const DEFAULT_TIMES = { checkIn: '16:00', checkOut: '12:00' };

export function toMessagingBooking(r: SmoobuReservation): BookingForMessaging {
  return {
    id: r.id,
    type: r.type,
    isBlocked: Boolean(r['is-blocked-booking']),
    channel: r.channel?.name || '',
    apartmentId: r.apartment?.id,
    createdAt: r['created-at'] || `${r.arrival} 00:00`,
    arrival: r.arrival,
    departure: r.departure,
    firstName: r.firstname || '',
    guestName: r['guest-name'] || '',
    language: r.language || '',
    checkIn: r['check-in'] || null,
    checkOut: r['check-out'] || null,
    price: Number(r.price) || 0,
    email: r.email || null,
    adults: Number(r.adults) || 0,
    children: Number(r.children) || 0,
  };
}

export async function getSettings(userId: string): Promise<{ mode: MessagingMode; liveChannels: string[] }> {
  const row = (await db.execute({ sql: 'SELECT mode, live_channels FROM message_settings WHERE user_id = ?', args: [userId] })).rows[0] as any;
  return {
    mode: (row?.mode as MessagingMode) || 'off',
    liveChannels: String(row?.live_channels || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export async function saveSettings(userId: string, mode: MessagingMode, liveChannels: string[]) {
  await db.execute({
    sql: `INSERT INTO message_settings (user_id, mode, live_channels, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, live_channels = excluded.live_channels, updated_at = excluded.updated_at`,
    args: [userId, mode, liveChannels.join(',')],
  });
}

export async function loadTemplates(userId: string): Promise<MessageTemplate[]> {
  const rows = (await db.execute({ sql: 'SELECT * FROM message_template WHERE user_id = ? ORDER BY id', args: [userId] })).rows as any[];
  return rows.map((r) => ({
    key: r.key,
    anchor: r.anchor,
    offsetDays: Number(r.offset_days),
    sendTime: r.send_time || null,
    subject: { fr: r.subject_fr || null, en: r.subject_en || null },
    body: { fr: r.body_fr, en: r.body_en },
    active: Boolean(r.active),
  }));
}

/** [k_*] values per apartment and language, decrypted. */
export async function loadPlaceholders(userId: string): Promise<Map<string, Record<string, string>>> {
  const rows = (await db.execute({
    sql: 'SELECT smoobu_apartment_id, key, lang, value_encrypted FROM message_placeholder WHERE user_id = ?',
    args: [userId],
  })).rows as any[];
  const out = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const k = `${r.smoobu_apartment_id}:${r.lang}`;
    if (!out.has(k)) out.set(k, {});
    out.get(k)![r.key] = decryptApiKey(String(r.value_encrypted));
  }
  return out;
}

export async function savePlaceholder(userId: string, apartmentId: number, key: string, lang: Lang, value: string) {
  await db.execute({
    sql: `INSERT INTO message_placeholder (user_id, smoobu_apartment_id, key, lang, value_encrypted) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, smoobu_apartment_id, key, lang) DO UPDATE SET value_encrypted = excluded.value_encrypted`,
    args: [userId, apartmentId, key, lang, encryptApiKey(value)],
  });
}

async function loadCredentials(userId: string): Promise<SmoobuCredentials | null> {
  const row = (await db.execute({ sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?', args: [userId] })).rows[0] as any;
  return row?.smoobu_api_key_encrypted ? parseSmoobuCredentials(decryptApiKey(row.smoobu_api_key_encrypted)) : null;
}

export interface PlannedMessage {
  bookingId: number;
  templateKey: string;
  channel: string;
  apartmentId: number;
  guestName: string;
  arrival: string;
  departure: string;
  lang: Lang;
  sendAt: string;
  due: boolean;
  subject: string | null;
  body: string;
}

/** Every message the templates produce for current bookings whose send time falls in [from, to]. */
export function planMessages(
  bookings: BookingForMessaging[],
  templates: MessageTemplate[],
  placeholders: Map<string, Record<string, string>>,
  now: Date,
  from: Date,
  to: Date,
): PlannedMessage[] {
  const out: PlannedMessage[] = [];
  for (const b of bookings) {
    if (skipReason(b)) continue;
    for (const t of templates) {
      if (!t.active || t.anchor === 'manual') continue;
      const at = sendAtFor(t, b);
      const due = isDue(t, b, now);
      if (!due && (at < from || at > to)) continue;
      if (!due && at <= now) continue; // past and not due: skipped by the rules
      const lang = langFor(b);
      const ph = placeholders.get(`${b.apartmentId}:${lang}`) || {};
      out.push({
        bookingId: b.id, templateKey: t.key, channel: b.channel, apartmentId: b.apartmentId,
        guestName: b.guestName, arrival: b.arrival, departure: b.departure, lang,
        sendAt: at.toISOString(), due,
        subject: t.subject[lang] ? render(t.subject[lang]!, b, lang, ph, DEFAULT_TIMES) : null,
        body: render(t.body[lang], b, lang, ph, DEFAULT_TIMES),
      });
    }
  }
  return out.sort((a, b) => a.sendAt.localeCompare(b.sendAt));
}

/**
 * Quick reply: render template `key` for one booking (guest language, apartment placeholders).
 * Sends it through Smoobu only when `send` is true; logged like automatic messages.
 */
export async function replyToBooking(userId: string, bookingId: number, key: string, send: boolean) {
  const creds = await loadCredentials(userId);
  if (!creds) throw new Error('Smoobu API key not configured');
  const template = (await loadTemplates(userId)).find((t) => t.key === key);
  if (!template) throw new Error(`No template ${key}`);
  const res = await smoobuFetch(creds, `/api/reservations/${bookingId}`);
  if (!res.ok) throw new Error(`Smoobu booking ${bookingId}: ${res.status}`);
  const b = toMessagingBooking(await res.json());
  const lang = langFor(b);
  const ph = (await loadPlaceholders(userId)).get(`${b.apartmentId}:${lang}`) || {};
  const body = render(template.body[lang], b, lang, ph, DEFAULT_TIMES);
  const subject = template.subject[lang] ? render(template.subject[lang]!, b, lang, ph, DEFAULT_TIMES) : null;
  if (!send) return { bookingId, key, lang, channel: b.channel, guestName: b.guestName, sent: false, body };

  const out = await smoobuFetch(creds, `/api/reservations/${bookingId}/messages/send-message-to-guest`, {
    method: 'POST',
    body: { subject: subject || undefined, messageBody: body },
  });
  const error = out.ok ? null : `${out.status} ${(await out.text()).slice(0, 300)}`;
  await db.execute({
    sql: `INSERT INTO message_log (user_id, smoobu_booking_id, template_key, mode, status, channel, apartment_id, guest_name, lang, send_at, body, error)
          VALUES (?, ?, ?, 'reply', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, smoobu_booking_id, template_key, mode) DO UPDATE SET
            status = excluded.status, body = excluded.body, error = excluded.error, created_at = datetime('now')`,
    args: [userId, bookingId, key, out.ok ? 'sent' : 'failed', b.channel, b.apartmentId, b.guestName, lang,
      new Date().toISOString(), body, error],
  });
  return { bookingId, key, lang, channel: b.channel, guestName: b.guestName, sent: out.ok, error, body };
}

async function currentBookings(creds: SmoobuCredentials): Promise<BookingForMessaging[]> {
  return (await fetchSmoobuBookings(creds)).map(toMessagingBooking);
}

/** Preview for the owner: what is due now and what goes out in the next `days` days. */
export async function previewMessages(userId: string, days = 7, now = new Date()) {
  const creds = await loadCredentials(userId);
  if (!creds) throw new Error('Smoobu API key not configured');
  const [bookings, templates, placeholders, settings] = await Promise.all([
    currentBookings(creds), loadTemplates(userId), loadPlaceholders(userId), getSettings(userId),
  ]);
  const planned = planMessages(bookings, templates, placeholders, now, now, new Date(now.getTime() + days * 86400000));
  return { settings, templates: templates.length, messages: planned };
}

/**
 * One scheduler tick for one user: sends (live) or records (dry_run) every due message
 * that has not been sent yet. Live sending only for channels listed in live_channels.
 */
export async function runMessaging(userId: string, now = new Date()) {
  const settings = await getSettings(userId);
  if (settings.mode === 'off') return { userId, mode: 'off', due: 0, sent: 0, recorded: 0, failed: 0 };
  const creds = await loadCredentials(userId);
  if (!creds) return { userId, mode: settings.mode, error: 'no Smoobu key', due: 0, sent: 0, recorded: 0, failed: 0 };

  const [bookings, templates, placeholders] = await Promise.all([
    currentBookings(creds), loadTemplates(userId), loadPlaceholders(userId),
  ]);
  const due = planMessages(bookings, templates, placeholders, now, now, now).filter((m) => m.due);
  const sentRows = (await db.execute({
    sql: "SELECT smoobu_booking_id, template_key FROM message_log WHERE user_id = ? AND status = 'sent'",
    args: [userId],
  })).rows as any[];
  const alreadySent = new Set(sentRows.map((r) => `${r.smoobu_booking_id}:${r.template_key}`));

  let sent = 0, recorded = 0, failed = 0;
  for (const m of due) {
    if (alreadySent.has(`${m.bookingId}:${m.templateKey}`)) continue;
    const live = settings.mode === 'live' && settings.liveChannels.includes(m.channel);
    let status = 'dry_run', error: string | null = null;
    if (live) {
      const res = await smoobuFetch(creds, `/api/reservations/${m.bookingId}/messages/send-message-to-guest`, {
        method: 'POST',
        body: { subject: m.subject || undefined, messageBody: m.body },
      });
      status = res.ok ? 'sent' : 'failed';
      if (!res.ok) error = `${res.status} ${(await res.text()).slice(0, 300)}`;
    }
    await db.execute({
      sql: `INSERT INTO message_log (user_id, smoobu_booking_id, template_key, mode, status, channel, apartment_id, guest_name, lang, send_at, body, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, smoobu_booking_id, template_key, mode) DO UPDATE SET
              status = excluded.status, body = excluded.body, error = excluded.error, created_at = datetime('now')`,
      args: [userId, m.bookingId, m.templateKey, live ? 'live' : 'dry_run', status, m.channel, m.apartmentId,
        m.guestName, m.lang, m.sendAt, m.body, error],
    });
    if (status === 'sent') sent++; else if (status === 'failed') failed++; else recorded++;
  }
  return { userId, mode: settings.mode, due: due.length, sent, recorded, failed };
}

/** Scheduler entry point: every user whose messaging is not off. */
export async function runMessagingForAll(now = new Date()) {
  const users = (await db.execute("SELECT user_id FROM message_settings WHERE mode != 'off'")).rows as any[];
  const results = [];
  for (const u of users) {
    try {
      results.push(await runMessaging(String(u.user_id), now));
    } catch (e: any) {
      results.push({ userId: u.user_id, error: e.message });
    }
  }
  return results;
}
