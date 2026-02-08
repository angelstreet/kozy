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

export default handler;
