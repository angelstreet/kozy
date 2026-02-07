import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import db, { initDB, seed, seedTestData, clearAll } from './db.js';

initDB();
seed();

const app = new Hono();
app.use('/*', cors());

// Properties
app.get('/api/properties', (c) => {
  const rows = db.prepare('SELECT * FROM property').all();
  return c.json(rows);
});

app.post('/api/properties', async (c) => {
  const body = await c.req.json();
  const { name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking, cleaner_id } = body;
  
  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  const result = db.prepare(`
    INSERT INTO property (name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, address,
    checkout_time || '10:00', checkin_time || '16:00',
    cleaning_mins || 120, rate || 50, sunday_rate || 70,
    color || '#3B82F6', ical_airbnb || null, ical_booking || null
  );

  const propertyId = result.lastInsertRowid;

  // Assign cleaner if provided
  if (cleaner_id) {
    db.prepare('INSERT INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)').run(propertyId, cleaner_id, 'primary');
  }

  const property = db.prepare('SELECT * FROM property WHERE id = ?').get(propertyId);
  return c.json(property, 201);
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
app.get('/api/cleaners', (c) => {
  const rows = db.prepare('SELECT * FROM cleaner').all();
  return c.json(rows);
});

app.post('/api/cleaners', async (c) => {
  const body = await c.req.json();
  const { name, email, phone } = body;
  if (!name || !email) return c.json({ error: 'Name and email required' }, 400);
  
  const result = db.prepare('INSERT INTO cleaner (name, email, phone, status) VALUES (?, ?, ?, ?)').run(name, email, phone || null, 'active');
  const cleaner = db.prepare('SELECT * FROM cleaner WHERE id = ?').get(result.lastInsertRowid);
  return c.json(cleaner, 201);
});

app.post('/api/cleaners/invite', async (c) => {
  const body = await c.req.json();
  const { name, email } = body;
  if (!name || !email) return c.json({ error: 'Name and email required' }, 400);
  
  const result = db.prepare('INSERT INTO cleaner (name, email, status) VALUES (?, ?, ?)').run(name, email, 'invited');
  const cleaner = db.prepare('SELECT * FROM cleaner WHERE id = ?').get(result.lastInsertRowid);
  return c.json(cleaner, 201);
});

app.get('/api/cleaners/:id', (c) => {
  const id = c.req.param('id');
  const cleaner = db.prepare('SELECT * FROM cleaner WHERE id = ?').get(id);
  if (!cleaner) return c.json({ error: 'Not found' }, 404);
  const assignments = db.prepare('SELECT pc.*, p.name as property_name FROM property_cleaner pc JOIN property p ON p.id = pc.property_id WHERE pc.cleaner_id = ?').all(id);
  return c.json({ ...(cleaner as any), assignments });
});

app.post('/api/cleaners/:id/assign', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { property_id, role } = body;
  if (!property_id || !role) return c.json({ error: 'property_id and role required' }, 400);
  
  db.prepare('INSERT OR REPLACE INTO property_cleaner (property_id, cleaner_id, role) VALUES (?, ?, ?)').run(property_id, id, role);
  return c.json({ ok: true });
});

app.get('/api/tasks', (c) => {
  const rows = db.prepare('SELECT * FROM cleaning_task').all();
  return c.json(rows);
});

app.get('/api/payments', (c) => {
  const rows = db.prepare('SELECT * FROM payment').all();
  return c.json(rows);
});

app.get('/api/shopping', (c) => {
  const rows = db.prepare('SELECT * FROM shopping_request').all();
  return c.json(rows);
});

app.get('/api/bookings', (c) => {
  const rows = db.prepare('SELECT * FROM booking').all();
  return c.json(rows);
});

// Seed / Reset
app.post('/api/seed', (c) => {
  seedTestData();
  return c.json({ ok: true, message: 'Test data seeded' });
});

app.post('/api/reset', (c) => {
  clearAll();
  return c.json({ ok: true, message: 'All data cleared' });
});

serve({ fetch: app.fetch, port: 3002 }, () => {
  console.log('Kozy API running on http://localhost:3002');
});
