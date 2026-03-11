import { Hono } from 'hono';
import db from '../db.js';
import { kozyIntegrationManifest } from '../integration/manifest.js';
import { kozyIntegrationActions, runKozyIntegrationAction, type KozyIntegrationActionId } from '../integration/actions.js';

type Variables = {
  userId: string;
};

const router = new Hono<{ Variables: Variables }>();

async function ensureKozyUser(userId: string) {
  await db.execute({
    sql: 'INSERT INTO user (id, updated_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = ?',
    args: [userId, new Date().toISOString(), new Date().toISOString()],
  });
}

router.get('/api/integration/status', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await ensureKozyUser(userId);

  const propertyWhere = userId !== 'dev-user' ? 'WHERE (user_id = ? OR user_id IS NULL)' : '';
  const propertyArgs: string[] = userId !== 'dev-user' ? [userId] : [];

  const [userRes, propertyRes, bookingRes, taskRes] = await Promise.all([
    db.execute({ sql: 'SELECT id, smoobu_api_key_encrypted FROM user WHERE id = ?', args: [userId] }),
    db.execute({ sql: `SELECT COUNT(*) as c FROM property ${propertyWhere}`, args: propertyArgs }),
    db.execute({
      sql: `
        SELECT COUNT(*) as c
        FROM booking b
        JOIN property p ON p.id = b.property_id
        ${propertyWhere ? `${propertyWhere} AND` : 'WHERE'} (b.status IS NULL OR b.status != 'cancelled')
      `,
      args: propertyArgs,
    }),
    db.execute({
      sql: `
        SELECT COUNT(*) as c
        FROM cleaning_task ct
        JOIN property p ON p.id = ct.property_id
        ${propertyWhere}
      `,
      args: propertyArgs,
    }),
  ]);

  const user = userRes.rows[0] as any;
  const properties = Number((propertyRes.rows[0] as any)?.c || 0);
  const bookings = Number((bookingRes.rows[0] as any)?.c || 0);
  const tasks = Number((taskRes.rows[0] as any)?.c || 0);
  const hasSmoobuKey = Boolean(user?.smoobu_api_key_encrypted);

  const availableFeatures = ['properties'];
  if (bookings > 0) availableFeatures.push('occupancy', 'turnovers');
  if (tasks > 0) availableFeatures.push('cleaning');
  if (hasSmoobuKey) availableFeatures.push('smoobu_sync');

  return c.json({
    app_id: 'kozy',
    authenticated: true,
    auth_mode: process.env.CLERK_SECRET_KEY ? 'clerk' : 'local',
    exists: true,
    local_user_id: userId,
    clerk_user_id: process.env.CLERK_SECRET_KEY ? userId : null,
    onboarded: properties > 0 || hasSmoobuKey,
    available_features: availableFeatures,
    summary: {
      has_properties: properties > 0,
      has_bookings: bookings > 0,
      has_cleaning_tasks: tasks > 0,
      has_smoobu_key: hasSmoobuKey,
      counts: {
        properties,
        bookings,
        tasks,
      },
    },
  });
});

router.get('/api/integration/actions', (c) => c.json(kozyIntegrationManifest));

router.post('/api/integration/execute/:actionId', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const actionId = c.req.param('actionId') as KozyIntegrationActionId;
  if (!kozyIntegrationActions.find((action) => action.id === actionId)) {
    return c.json({ error: 'Unknown integration action' }, 404);
  }

  let input: Record<string, any> = {};
  try {
    input = await c.req.json();
  } catch {
    input = {};
  }

  const result = await runKozyIntegrationAction(actionId, userId, input);
  return c.json(result);
});

export default router;
