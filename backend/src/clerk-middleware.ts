import { verifyToken } from '@clerk/backend';
import type { Context, Next } from 'hono';

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

/**
 * Hono middleware that verifies Clerk session tokens.
 * Sets c.set('userId', ...) on success.
 * Skips auth if CLERK_SECRET_KEY is not set (dev mode).
 */
export async function clerkAuth(c: Context, next: Next) {
  // Dev mode: no Clerk key = skip auth
  if (!clerkSecretKey) {
    // Check for local dev user ID header
    const localUserId = c.req.header('X-Local-User-Id');
    if (localUserId) {
      c.set('userId', localUserId);
    } else {
      c.set('userId', 'dev-user');
    }
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, { secretKey: clerkSecretKey });
    c.set('userId', payload.sub);
    return next();
  } catch (e: any) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

/**
 * The signed-in user on a route that skips clerkAuth (e.g. the invite pages), or null when there is no valid
 * token. Dev mode (no Clerk key): X-Local-User-Id or 'dev-user'.
 */
export async function optionalUserId(c: Context): Promise<string | null> {
  if (!clerkSecretKey) return c.req.header('X-Local-User-Id') || 'dev-user';
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return (await verifyToken(authHeader.slice(7), { secretKey: clerkSecretKey })).sub;
  } catch {
    return null;
  }
}
