import { Hono } from 'hono';
import { cors } from 'hono/cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db, { initDB, seed, migrate, seedTestData, clearAll } from './db.js';
import { fetchAndParseIcal, syncPropertyIcal } from './ical-sync.js';
import { syncSmoobuData, syncSmoobuBookings } from './smoobu-sync.js';
import { syncProperty } from './unified-sync.js';
import { clerkAuth } from './clerk-middleware.js';

type Variables = {
  userId: string;
};

const app = new Hono<{ Variables: Variables }>();
app.use('/*', cors());

// Protect all /api/* routes except /api/external/*, /api/invite/*, /api/seed, /api/reset
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  // Skip auth for external API (has own token), invite routes, seed/reset, and health
  if (path.startsWith('/api/external/') || path.startsWith('/api/invite/') ||
      path === '/api/seed' || path === '/api/reset') {
    return next();
  }
  return clerkAuth(c, next);
});

// Init DB on first request (lazy init for serverless)
let dbReady = false;
app.use('/*', async (c, next) => {
  if (!dbReady) {
    await initDB();
    await migrate();
    await seed();
    dbReady = true;
  }
  await next();
});

// Properties (filtered by userId)
app.get('/api/properties', async (c) => {
  const userId = c.get('userId');
  const result = userId && userId !== 'dev-user'
    ? await db.execute({ sql: 'SELECT * FROM property WHERE user_id = ? OR user_id IS NULL', args: [userId] })
    : await db.execute('SELECT * FROM property');
  return c.json(result.rows);
});

app.post('/api/properties', async (c) => {
  const body = await c.req.json();
  const { name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking, cleaner_id, purchase_price, travaux, monthly_charges, monthly_revenue, credit_mensuel, smoobu_apartment_id } = body;

  if (!name) return c.json({ error: 'Name is required' }, 400);

  const userId = c.get('userId');
  const result = await db.execute({
    sql: `INSERT INTO property (name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking, user_id, purchase_price, travaux, monthly_charges, monthly_revenue, credit_mensuel, smoobu_apartment_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [name, address ?? null, checkout_time || '10:00', checkin_time || '16:00', cleaning_mins || 120, rate || 50, sunday_rate || 70, color || '#3B82F6', ical_airbnb || null, ical_booking || null, userId || null, purchase_price ?? null, travaux ?? 0, monthly_charges ?? 0, monthly_revenue ?? 0, credit_mensuel ?? 0, smoobu_apartment_id ?? null],
  });

  const propertyId = Number(result.lastInsertRowid);

  if (cleaner_id) {
    await db.execute({ sql: 'INSERT INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)', args: [propertyId, cleaner_id, 'primary'] });
  }

  const prop = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [propertyId] });
  return c.json(prop.rows[0], 201);
});

// iCal test
app.post('/api/properties/:id/ical-test', async (c) => {
  const body = await c.req.json();
  const { url } = body;
  if (!url) return c.json({ valid: false, error: 'No URL provided' }, 400);

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await resp.text();
    const valid = text.includes('BEGIN:VCALENDAR');
    return c.json({ valid, status: resp.status });
  } catch (e: any) {
    return c.json({ valid: false, error: e.message });
  }
});

// Cleaners
app.get('/api/cleaners', async (c) => {
  const result = await db.execute(`
    SELECT c.*, COUNT(pc.property_id) as property_count
    FROM cleaner c
    LEFT JOIN property_cleaner pc ON pc.cleaner_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
  return c.json(result.rows);
});

app.post('/api/cleaners', async (c) => {
  const body = await c.req.json();
  const { name, email, phone } = body;
  if (!name || !email) return c.json({ error: 'Name and email required' }, 400);

  const result = await db.execute({ sql: 'INSERT INTO cleaner (name, email, phone, status) VALUES (?, ?, ?, ?)', args: [name, email, phone || null, 'active'] });
  const cleaner = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return c.json(cleaner.rows[0], 201);
});

app.post('/api/cleaners/invite', async (c) => {
  const body = await c.req.json();
  const { name, email, phone, invite_method, language, property_assignments } = body;

  if (!name) return c.json({ error: 'Name is required' }, 400);
  if (invite_method === 'email' && !email) return c.json({ error: 'Email required for email invite' }, 400);
  if (invite_method === 'whatsapp' && !phone) return c.json({ error: 'Phone required for WhatsApp invite' }, 400);

  const invite_token = crypto.randomBytes(16).toString('hex');

  const result = await db.execute({
    sql: 'INSERT INTO cleaner (name, email, phone, status, invite_token, invite_method, invite_sent_at, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [name, email || null, phone || null, 'invited', invite_token, invite_method || 'email', new Date().toISOString(), language || 'fr'],
  });

  const cleanerId = Number(result.lastInsertRowid);

  if (property_assignments && Array.isArray(property_assignments)) {
    for (const { property_id, role } of property_assignments) {
      await db.execute({ sql: 'INSERT OR REPLACE INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)', args: [property_id, cleanerId, role || 'primary'] });
    }
  }

  const cleaner = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [cleanerId] });
  return c.json(cleaner.rows[0], 201);
});

// Accept invite
app.get('/api/invite/:token', async (c) => {
  const token = c.req.param('token');
  const result = await db.execute({
    sql: `SELECT c.*, GROUP_CONCAT(p.name) as property_names FROM cleaner c LEFT JOIN property_cleaner pc ON pc.cleaner_id = c.id LEFT JOIN property p ON p.id = pc.property_id WHERE c.invite_token = ? GROUP BY c.id`,
    args: [token],
  });
  const cleaner = result.rows[0] as any;
  if (!cleaner) return c.json({ error: 'Invalid or expired invite' }, 404);
  return c.json({ name: cleaner.name, status: cleaner.status, properties: cleaner.property_names?.split(',') || [], language: cleaner.language });
});

app.post('/api/invite/:token/accept', async (c) => {
  const token = c.req.param('token');
  const result = await db.execute({ sql: 'SELECT * FROM cleaner WHERE invite_token = ?', args: [token] });
  const cleaner = result.rows[0] as any;
  if (!cleaner) return c.json({ error: 'Invalid or expired invite' }, 404);
  if (cleaner.status === 'active') return c.json({ error: 'Invite already accepted' }, 400);

  const body = await c.req.json();
  const { phone, email } = body;

  await db.execute({
    sql: 'UPDATE cleaner SET status = ?, invite_accepted_at = ?, phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?',
    args: ['active', new Date().toISOString(), phone || null, email || null, cleaner.id],
  });

  const updated = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [cleaner.id] });
  return c.json(updated.rows[0]);
});

// Resend invite
app.post('/api/cleaners/:id/resend-invite', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [id] });
  const cleaner = result.rows[0] as any;
  if (!cleaner) return c.json({ error: 'Not found' }, 404);
  if (!cleaner.invite_token) return c.json({ error: 'No invite token' }, 400);

  await db.execute({ sql: 'UPDATE cleaner SET invite_sent_at = ? WHERE id = ?', args: [new Date().toISOString(), id] });
  return c.json({ ok: true, invite_token: cleaner.invite_token, invite_method: cleaner.invite_method });
});

app.get('/api/cleaners/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [id] });
  const cleaner = result.rows[0];
  if (!cleaner) return c.json({ error: 'Not found' }, 404);
  const assignments = await db.execute({
    sql: 'SELECT pc.*, p.name as property_name FROM property_cleaner pc JOIN property p ON p.id = pc.property_id WHERE pc.cleaner_id = ?',
    args: [id],
  });
  return c.json({ ...(cleaner as any), assignments: assignments.rows });
});

app.post('/api/cleaners/:id/assign', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { property_id, role } = body;
  if (!property_id || !role) return c.json({ error: 'property_id and role required' }, 400);

  await db.execute({ sql: 'INSERT OR REPLACE INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)', args: [property_id, id, role] });
  return c.json({ ok: true });
});

app.put('/api/cleaners/:id/assignments', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { assignments } = body; // [{property_id, role}]
  await db.execute({ sql: 'DELETE FROM property_cleaner WHERE cleaner_id = ?', args: [id] });
  if (Array.isArray(assignments)) {
    for (const { property_id, role } of assignments) {
      await db.execute({ sql: 'INSERT INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)', args: [property_id, id, role || 'primary'] });
    }
  }
  return c.json({ ok: true });
});

app.put('/api/cleaners/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { name, email, phone } = body;
  if (!name) return c.json({ error: 'Name is required' }, 400);
  await db.execute({ sql: 'UPDATE cleaner SET name = ?, email = ?, phone = ? WHERE id = ?', args: [name, email || null, phone || null, id] });
  const result = await db.execute({ sql: 'SELECT * FROM cleaner WHERE id = ?', args: [id] });
  return c.json(result.rows[0]);
});

app.delete('/api/cleaners/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.execute({ sql: 'DELETE FROM property_cleaner WHERE cleaner_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM cleaning_task WHERE assigned_to = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM payment WHERE cleaner_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM cleaner WHERE id = ?', args: [id] });
  return c.json({ ok: true });
});

// Property update & delete
app.put('/api/properties/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking, purchase_price, travaux, monthly_charges, monthly_revenue, credit_mensuel, smoobu_apartment_id } = body;
  await db.execute({
    sql: `UPDATE property SET name=?, address=?, checkout_time=?, checkin_time=?, cleaning_mins=?, rate=?, sunday_rate=?, color=?, ical_airbnb=?, ical_booking=?, purchase_price=?, travaux=?, monthly_charges=?, monthly_revenue=?, credit_mensuel=?, smoobu_apartment_id=? WHERE id=?`,
    args: [name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb || null, ical_booking || null, purchase_price ?? null, travaux ?? 0, monthly_charges ?? 0, monthly_revenue ?? 0, credit_mensuel ?? 0, smoobu_apartment_id ?? null, id],
  });
  const prop = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [id] });
  if (prop.rows.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(prop.rows[0]);
});

app.patch('/api/properties/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  if (body.enabled !== undefined) {
    await db.execute({ sql: 'UPDATE property SET enabled = ? WHERE id = ?', args: [body.enabled ? 1 : 0, id] });
  }
  const prop = await db.execute({ sql: 'SELECT * FROM property WHERE id = ?', args: [id] });
  if (prop.rows.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(prop.rows[0]);
});

app.delete('/api/properties/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.execute({ sql: 'DELETE FROM property_cleaner WHERE property_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM shopping_request WHERE property_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM cleaning_task WHERE property_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM booking WHERE property_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM property WHERE id = ?', args: [id] });
  return c.json({ ok: true });
});

// Tasks
app.get('/api/tasks', async (c) => {
  const result = await db.execute(`
    SELECT ct.*, p.name as property_name, cl.name as cleaner_name
    FROM cleaning_task ct
    LEFT JOIN property p ON p.id = ct.property_id
    LEFT JOIN cleaner cl ON cl.id = ct.assigned_to
  `);
  return c.json(result.rows);
});

app.patch('/api/tasks/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { status } = body;
  if (!status) return c.json({ error: 'status required' }, 400);
  await db.execute({ sql: 'UPDATE cleaning_task SET status = ? WHERE id = ?', args: [status, id] });
  const task = await db.execute({ sql: 'SELECT * FROM cleaning_task WHERE id = ?', args: [id] });
  return c.json(task.rows[0]);
});

// Payments
app.get('/api/payments', async (c) => {
  const result = await db.execute(`
    SELECT p.*, cl.name as cleaner_name, ct.date as task_date, pr.name as property_name
    FROM payment p
    LEFT JOIN cleaner cl ON cl.id = p.cleaner_id
    LEFT JOIN cleaning_task ct ON ct.id = p.task_id
    LEFT JOIN property pr ON pr.id = ct.property_id
  `);
  return c.json(result.rows);
});

app.patch('/api/payments/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const paid = body.paid ? 1 : 0;
  const paid_at = paid ? new Date().toISOString() : null;
  await db.execute({ sql: 'UPDATE payment SET paid = ?, paid_at = ? WHERE id = ?', args: [paid, paid_at, id] });
  const payment = await db.execute({ sql: 'SELECT * FROM payment WHERE id = ?', args: [id] });
  return c.json(payment.rows[0]);
});

// Shopping
app.get('/api/shopping', async (c) => {
  const result = await db.execute(`
    SELECT sr.*, p.name as property_name, cl.name as cleaner_name
    FROM shopping_request sr
    LEFT JOIN property p ON p.id = sr.property_id
    LEFT JOIN cleaner cl ON cl.id = sr.cleaner_id
  `);
  return c.json(result.rows);
});

app.post('/api/shopping', async (c) => {
  const body = await c.req.json();
  const { property_id, cleaner_id, items } = body;
  if (!property_id || !items) return c.json({ error: 'property_id and items required' }, 400);
  const result = await db.execute({ sql: 'INSERT INTO shopping_request (property_id, cleaner_id, items) VALUES (?, ?, ?)', args: [property_id, cleaner_id || null, items] });
  const sr = await db.execute({ sql: 'SELECT * FROM shopping_request WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return c.json(sr.rows[0], 201);
});

app.patch('/api/shopping/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { status } = body;
  await db.execute({ sql: 'UPDATE shopping_request SET status = ? WHERE id = ?', args: [status, id] });
  const sr = await db.execute({ sql: 'SELECT * FROM shopping_request WHERE id = ?', args: [id] });
  return c.json(sr.rows[0]);
});

// Bookings
app.get('/api/bookings', async (c) => {
  const result = await db.execute(`
    SELECT b.*, p.name as property_name, p.color as property_color
    FROM booking b
    LEFT JOIN property p ON p.id = b.property_id
    WHERE b.status != 'cancelled'
  `);
  return c.json(result.rows);
});

// iCal preview
app.post('/api/ical-preview', async (c) => {
  const { url } = await c.req.json();
  if (!url) return c.json({ error: 'URL required' }, 400);
  try {
    const bookings = await fetchAndParseIcal(url);
    return c.json({ valid: true, count: bookings.length, bookings });
  } catch (e: any) {
    return c.json({ valid: false, error: e.message }, 400);
  }
});

// Sync for a single property (unified: Smoobu primary, iCal fallback)
app.post('/api/properties/:id/sync', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  try {
    const result = await syncProperty(id, userId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Legacy iCal sync endpoint (kept for backward compatibility)
app.post('/api/properties/:id/ical-sync', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  try {
    const result = await syncProperty(id, userId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Sync all properties (unified: Smoobu primary, iCal fallback)
app.post('/api/sync-all', async (c) => {
  const userId = c.get('userId');
  const properties = userId && userId !== 'dev-user'
    ? await db.execute({ sql: 'SELECT id FROM property WHERE user_id = ? OR user_id IS NULL', args: [userId] })
    : await db.execute('SELECT id FROM property');
  
  const results = [];
  for (const p of properties.rows as any[]) {
    try {
      const result = await syncProperty(p.id, userId);
      results.push(result);
    } catch (e: any) {
      results.push({ propertyId: p.id, error: e.message });
    }
  }
  return c.json({ synced: results.length, results });
});

// Legacy iCal sync all endpoint (kept for backward compatibility)
app.post('/api/ical-sync-all', async (c) => {
  const userId = c.get('userId');
  const properties = userId && userId !== 'dev-user'
    ? await db.execute({ sql: 'SELECT id FROM property WHERE user_id = ? OR user_id IS NULL', args: [userId] })
    : await db.execute('SELECT id FROM property');
  
  const results = [];
  for (const p of properties.rows as any[]) {
    try {
      const result = await syncProperty(p.id, userId);
      results.push(result);
    } catch (e: any) {
      results.push({ propertyId: p.id, error: e.message });
    }
  }
  return c.json({ synced: results.length, results });
});

// Sync all properties (unified: Smoobu primary, iCal fallback) - alias for /api/sync-all
app.post('/api/smoobu-sync', async (c) => {
  const userId = c.get('userId');
  const properties = userId && userId !== 'dev-user'
    ? await db.execute({ sql: 'SELECT id FROM property WHERE user_id = ? OR user_id IS NULL', args: [userId] })
    : await db.execute('SELECT id FROM property');
  
  const results = [];
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const p of properties.rows as any[]) {
    try {
      const result = await syncProperty(p.id, userId);
      results.push(result);
      totalCreated += result.created || 0;
      totalUpdated += result.updated || 0;
    } catch (e: any) {
      results.push({ propertyId: p.id, error: e.message });
    }
  }

  return c.json({
    synced: results.length,
    totalEnriched: totalCreated + totalUpdated, // For backward compatibility with frontend
    totalCreated,
    totalUpdated,
    results
  });
});

// List all Smoobu apartments
app.get('/api/smoobu/apartments', async (c) => {
  const userId = c.get('userId');

  // Get user's encrypted Smoobu API key
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });

  const encryptedKey = keyResult.rows[0] ? (keyResult.rows[0] as any).smoobu_api_key_encrypted : null;

  if (!encryptedKey) {
    return c.json({ error: 'Smoobu API key not configured. Please add it in Settings.' }, 400);
  }

  // Decrypt the API key
  const { decryptApiKey } = await import('./encryption.js');
  const apiKey = decryptApiKey(encryptedKey);

  try {
    const { fetchSmoobuApartments } = await import('./smoobu-sync.js');
    const apartments = await fetchSmoobuApartments(apiKey);
    return c.json({ apartments });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Sync ALL Smoobu bookings (auto-detects all apartments)
app.post('/api/smoobu/sync-all', async (c) => {
  const userId = c.get('userId');

  // Get user's encrypted Smoobu API key
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });

  const encryptedKey = keyResult.rows[0] ? (keyResult.rows[0] as any).smoobu_api_key_encrypted : null;

  if (!encryptedKey) {
    return c.json({ error: 'Smoobu API key not configured. Please add it in Settings.' }, 400);
  }

  // Decrypt the API key
  const { decryptApiKey } = await import('./encryption.js');
  const apiKey = decryptApiKey(encryptedKey);

  try {
    const { fetchSmoobuApartments, fetchSmoobuBookings, syncSmoobuBookings } = await import('./smoobu-sync.js');
    
    // Step 1: Fetch all apartments from Smoobu
    const apartments = await fetchSmoobuApartments(apiKey);
    
    // Step 2: Fetch all reservations from Smoobu
    const reservations = await fetchSmoobuBookings(apiKey);
    
    // Step 3: Get all existing properties from DB
    const propertiesResult = userId && userId !== 'dev-user'
      ? await db.execute({ sql: 'SELECT id, name, smoobu_apartment_id FROM property WHERE user_id = ? OR user_id IS NULL', args: [userId] })
      : await db.execute('SELECT id, name, smoobu_apartment_id FROM property');
    
    const properties = propertiesResult.rows as any[];
    
    // Step 4: For each apartment, find or update matching property
    const results = [];
    for (const apartment of apartments) {
      // Find existing property by smoobu_apartment_id or name
      let property = properties.find(p => p.smoobu_apartment_id === apartment.id);
      
      if (!property) {
        // Try matching by name (fuzzy)
        property = properties.find(p => 
          p.name.toLowerCase().includes(apartment.name.toLowerCase()) ||
          apartment.name.toLowerCase().includes(p.name.toLowerCase())
        );
        
        // Auto-update smoobu_apartment_id if found
        if (property) {
          await db.execute({
            sql: 'UPDATE property SET smoobu_apartment_id = ? WHERE id = ?',
            args: [apartment.id, property.id]
          });
          property.smoobu_apartment_id = apartment.id;
        }
      }
      
      if (property) {
        // Sync bookings for this property
        const syncResult = await syncSmoobuBookings(property.id, apiKey, apartment.id);
        results.push({
          propertyName: property.name,
          apartmentName: apartment.name,
          ...syncResult
        });
      } else {
        results.push({
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          skipped: true,
          reason: 'No matching property in Kozy (create property manually or rename to match)'
        });
      }
    }
    
    return c.json({
      success: true,
      apartments: apartments.length,
      synced: results.filter(r => !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      results
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Smoobu sync for a single property
app.post('/api/properties/:id/smoobu-sync', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');

  // Get user's encrypted Smoobu API key
  const keyResult = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });

  const encryptedKey = keyResult.rows[0] ? (keyResult.rows[0] as any).smoobu_api_key_encrypted : null;

  if (!encryptedKey) {
    return c.json({ error: 'Smoobu API key not configured. Please add it in Settings.' }, 400);
  }

  // Decrypt the API key
  const { decryptApiKey } = await import('./encryption.js');
  const apiKey = decryptApiKey(encryptedKey);

  // Get property's Smoobu apartment ID if configured
  const propResult = await db.execute({ sql: 'SELECT smoobu_apartment_id FROM property WHERE id = ?', args: [id] });
  const property = propResult.rows[0] as any;
  const apartmentId = property?.smoobu_apartment_id || undefined;

  try {
    const result = await syncSmoobuData(id, apiKey, apartmentId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// === API Token Management ===

app.get('/api/settings/api-token', async (c) => {
  let result = await db.execute('SELECT * FROM api_token WHERE revoked = 0 ORDER BY created_at DESC LIMIT 1');
  let token = result.rows[0] as any;
  if (!token) {
    const newToken = crypto.randomBytes(32).toString('hex');
    await db.execute({ sql: 'INSERT INTO api_token (token, name) VALUES (?, ?)', args: [newToken, 'default'] });
    const r = await db.execute({ sql: 'SELECT * FROM api_token WHERE token = ?', args: [newToken] });
    token = r.rows[0];
  }
  return c.json(token);
});

app.post('/api/settings/api-token/regenerate', async (c) => {
  await db.execute('UPDATE api_token SET revoked = 1 WHERE revoked = 0');
  const newToken = crypto.randomBytes(32).toString('hex');
  await db.execute({ sql: 'INSERT INTO api_token (token, name) VALUES (?, ?)', args: [newToken, 'default'] });
  const result = await db.execute({ sql: 'SELECT * FROM api_token WHERE token = ?', args: [newToken] });
  return c.json(result.rows[0]);
});

app.post('/api/settings/api-token/revoke', async (c) => {
  await db.execute('UPDATE api_token SET revoked = 1 WHERE revoked = 0');
  return c.json({ ok: true, message: 'All tokens revoked' });
});

// === Smoobu Settings ===

app.get('/api/settings/smoobu-key-exists', async (c) => {
  const userId = c.get('userId');
  const result = await db.execute({
    sql: 'SELECT smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [userId]
  });
  const hasKey = result.rows[0] && (result.rows[0] as any).smoobu_api_key_encrypted !== null;
  return c.json({ exists: hasKey });
});

app.get('/api/settings/smoobu-key', async (c) => {
  // SECURITY: Never return the plaintext key to frontend
  // This endpoint is removed for security reasons
  return c.json({ error: 'Endpoint disabled for security. API key is encrypted and cannot be retrieved.' }, 403);
});

app.post('/api/settings/smoobu-key', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { key } = body;

  if (!key) {
    return c.json({ error: 'key is required' }, 400);
  }

  // Test the API key first
  try {
    const testResponse = await fetch('https://login.smoobu.com/api/reservations', {
      method: 'GET',
      headers: {
        'Api-Key': key,
        'Content-Type': 'application/json',
      },
    });

    if (!testResponse.ok) {
      return c.json({ error: 'Invalid Smoobu API key' }, 400);
    }
  } catch (e: any) {
    return c.json({ error: 'Failed to validate Smoobu API key' }, 400);
  }

  // Encrypt and save the key
  const { encryptApiKey } = await import('./encryption.js');
  const encryptedKey = encryptApiKey(key);

  await db.execute({
    sql: 'INSERT INTO user (id, smoobu_api_key_encrypted, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET smoobu_api_key_encrypted = ?, updated_at = ?',
    args: [userId, encryptedKey, new Date().toISOString(), encryptedKey, new Date().toISOString()]
  });

  return c.json({ ok: true });
});

// === External API ===

async function validateExternalToken(c: any): Promise<boolean> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const result = await db.execute({ sql: 'SELECT * FROM api_token WHERE token = ? AND revoked = 0', args: [token] });
  const row = result.rows[0] as any;
  if (!row) return false;
  await db.execute({ sql: 'UPDATE api_token SET last_used_at = ? WHERE id = ?', args: [new Date().toISOString(), row.id] });
  return true;
}

app.get('/api/external/properties', async (c) => {
  if (!(await validateExternalToken(c))) {
    return c.json({ error: 'Unauthorized. Provide a valid Bearer token.' }, 401);
  }

  const propResult = await db.execute('SELECT * FROM property WHERE enabled = 1');
  const properties = propResult.rows as any[];

  const result = await Promise.all(properties.map(async (p: any) => {
    const bookingsResult = await db.execute({ sql: 'SELECT * FROM booking WHERE property_id = ?', args: [p.id] });
    const bookings = bookingsResult.rows as any[];

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let bookedNights = 0;
    for (const b of bookings) {
      const cin = new Date(b.checkin_date);
      const cout = new Date(b.checkout_date);
      const start = cin < new Date(monthStart) ? new Date(monthStart) : cin;
      const end = cout > new Date(monthEnd) ? new Date(monthEnd) : cout;
      const nights = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      bookedNights += nights;
    }

    const occupancyRate = daysInMonth > 0 ? Math.round((bookedNights / daysInMonth) * 100) : 0;

    const tasksResult = await db.execute({ sql: 'SELECT * FROM cleaning_task WHERE property_id = ?', args: [p.id] });
    const tasks = tasksResult.rows as any[];
    const totalCleaningCosts = tasks.reduce((sum: number, t: any) => sum + (t.rate || 0), 0);
    const estimatedRevenue = bookedNights * (p.rate || 50);

    return {
      id: p.id,
      name: p.name,
      address: p.address,
      color: p.color,
      enabled: !!p.enabled,
      bookings_count: bookings.length,
      occupancy: {
        current_month: {
          booked_nights: bookedNights,
          total_nights: daysInMonth,
          rate_percent: occupancyRate,
        },
      },
      costs: {
        cleaning_total: totalCleaningCosts,
        cleaning_tasks_count: tasks.length,
      },
      revenue: {
        estimated: estimatedRevenue,
        note: 'Estimated from booked nights. Connect a PMS for accurate revenue.',
      },
    };
  }));

  return c.json({ properties: result, generated_at: new Date().toISOString() });
});

// Seed / Reset
app.post('/api/seed', async (c) => {
  await seedTestData();
  return c.json({ ok: true, message: 'Test data seeded' });
});

app.post('/api/reset', async (c) => {
  await clearAll();
  return c.json({ ok: true, message: 'All data cleared' });
});

// Export app for Vercel adapter
export default app;

// Node.js server (only when not on Vercel)
if (!process.env.VERCEL) {
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port: 5002 }, () => {
    console.log('Kozy API running on http://localhost:5002');
  });
}
