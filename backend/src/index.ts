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

// Property update & delete
app.put('/api/properties/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb, ical_booking } = body;
  db.prepare(`UPDATE property SET name=?, address=?, checkout_time=?, checkin_time=?, cleaning_mins=?, rate=?, sunday_rate=?, color=?, ical_airbnb=?, ical_booking=? WHERE id=?`)
    .run(name, address, checkout_time, checkin_time, cleaning_mins, rate, sunday_rate, color, ical_airbnb || null, ical_booking || null, id);
  const property = db.prepare('SELECT * FROM property WHERE id = ?').get(id);
  if (!property) return c.json({ error: 'Not found' }, 404);
  return c.json(property);
});

app.delete('/api/properties/:id', (c) => {
  const id = c.req.param('id');
  db.prepare('DELETE FROM property_cleaner WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM shopping_request WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM cleaning_task WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM booking WHERE property_id = ?').run(id);
  db.prepare('DELETE FROM property WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// Tasks
app.get('/api/tasks', (c) => {
  const rows = db.prepare(`
    SELECT ct.*, p.name as property_name, cl.name as cleaner_name
    FROM cleaning_task ct
    LEFT JOIN property p ON p.id = ct.property_id
    LEFT JOIN cleaner cl ON cl.id = ct.assigned_to
  `).all();
  return c.json(rows);
});

app.patch('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;
  if (!status) return c.json({ error: 'status required' }, 400);
  db.prepare('UPDATE cleaning_task SET status = ? WHERE id = ?').run(status, id);
  const task = db.prepare('SELECT * FROM cleaning_task WHERE id = ?').get(id);
  return c.json(task);
});

// Payments
app.get('/api/payments', (c) => {
  const rows = db.prepare(`
    SELECT p.*, cl.name as cleaner_name, ct.date as task_date, pr.name as property_name
    FROM payment p
    LEFT JOIN cleaner cl ON cl.id = p.cleaner_id
    LEFT JOIN cleaning_task ct ON ct.id = p.task_id
    LEFT JOIN property pr ON pr.id = ct.property_id
  `).all();
  return c.json(rows);
});

app.patch('/api/payments/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const paid = body.paid ? 1 : 0;
  const paid_at = paid ? new Date().toISOString() : null;
  db.prepare('UPDATE payment SET paid = ?, paid_at = ? WHERE id = ?').run(paid, paid_at, id);
  const payment = db.prepare('SELECT * FROM payment WHERE id = ?').get(id);
  return c.json(payment);
});

// Shopping
app.get('/api/shopping', (c) => {
  const rows = db.prepare(`
    SELECT sr.*, p.name as property_name, cl.name as cleaner_name
    FROM shopping_request sr
    LEFT JOIN property p ON p.id = sr.property_id
    LEFT JOIN cleaner cl ON cl.id = sr.cleaner_id
  `).all();
  return c.json(rows);
});

app.post('/api/shopping', async (c) => {
  const body = await c.req.json();
  const { property_id, cleaner_id, items } = body;
  if (!property_id || !items) return c.json({ error: 'property_id and items required' }, 400);
  const result = db.prepare('INSERT INTO shopping_request (property_id, cleaner_id, items) VALUES (?, ?, ?)').run(property_id, cleaner_id || null, items);
  const sr = db.prepare('SELECT * FROM shopping_request WHERE id = ?').get(result.lastInsertRowid);
  return c.json(sr, 201);
});

app.patch('/api/shopping/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;
  db.prepare('UPDATE shopping_request SET status = ? WHERE id = ?').run(status, id);
  const sr = db.prepare('SELECT * FROM shopping_request WHERE id = ?').get(id);
  return c.json(sr);
});

// Bookings
app.get('/api/bookings', (c) => {
  const rows = db.prepare(`
    SELECT b.*, p.name as property_name, p.color as property_color
    FROM booking b
    LEFT JOIN property p ON p.id = b.property_id
  `).all();
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
