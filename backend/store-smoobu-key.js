#!/usr/bin/env node
// Store Smoobu credentials (encrypted) for a user. Run after `npm run build`:
//   SMOOBU_API_KEY_ID=usr_live_... SMOOBU_API_SECRET=... node store-smoobu-key.js [userId]
import db from './dist/db.js';
import { encryptApiKey } from './dist/encryption.js';
import { serializeSmoobuCredentials } from './dist/smoobu-client.js';

const keyId = process.env.SMOOBU_API_KEY_ID;
const secret = process.env.SMOOBU_API_SECRET;
const USER_ID = process.argv[2] || 'dev-user';

async function storeKey() {
  if (!keyId || !secret) throw new Error('Set SMOOBU_API_KEY_ID and SMOOBU_API_SECRET');
  const encryptedKey = encryptApiKey(serializeSmoobuCredentials({ keyId, secret }));
  await db.execute({
    sql: 'INSERT INTO user (id, smoobu_api_key_encrypted, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET smoobu_api_key_encrypted = ?, updated_at = ?',
    args: [USER_ID, encryptedKey, new Date().toISOString(), encryptedKey, new Date().toISOString()]
  });
  console.log(`✅ Smoobu credentials stored for ${USER_ID}`);
}

storeKey().catch((e) => { console.error(e.message); process.exit(1); });
