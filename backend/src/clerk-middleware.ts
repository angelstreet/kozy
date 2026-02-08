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
    c.set('userId', 'dev-user');
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
