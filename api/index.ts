import { handle } from 'hono/vercel';
import { initDB, migrate } from '../backend/src/db.js';
import app from '../backend/src/index.js';

let initialized = false;

const handler = async (req: Request) => {
  if (!initialized) {
    await initDB();
    await migrate();
    initialized = true;
  }
  return handle(app)(req);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
