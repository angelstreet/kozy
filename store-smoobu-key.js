#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

// Change to backend directory before importing db
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
process.chdir(join(__dirname, 'backend'));

import db from './dist/db.js';
import { encryptApiKey } from './dist/encryption.js';

const SMOOBU_API_KEY = 'g29HxSrjy9Kmq2xHp7iJOVCnaRASJAJidI03OYTyzY';
const USER_ID = 'dev-user';

async function storeKey() {
  console.log('🔐 Encrypting and storing Smoobu API key for dev-user...\n');

  // Encrypt the key
  const encryptedKey = encryptApiKey(SMOOBU_API_KEY);
  console.log(`✅ Key encrypted: ${encryptedKey.substring(0, 40)}...`);

  // Store in database
  await db.execute({
    sql: 'INSERT INTO user (id, smoobu_api_key_encrypted, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET smoobu_api_key_encrypted = ?, updated_at = ?',
    args: [USER_ID, encryptedKey, new Date().toISOString(), encryptedKey, new Date().toISOString()]
  });

  console.log('✅ Key stored in database');

  // Verify
  const result = await db.execute({
    sql: 'SELECT id, smoobu_api_key_encrypted FROM user WHERE id = ?',
    args: [USER_ID]
  });

  if (result.rows[0]) {
    console.log(`✅ Verified: User ${result.rows[0].id} has encrypted Smoobu key stored`);
  }
}

storeKey().catch(console.error);
