#!/usr/bin/env node
import db from './dist/db.js';
import crypto from 'crypto';

const token = crypto.randomBytes(32).toString('hex');
await db.execute({
  sql: 'INSERT INTO api_token (token, name) VALUES (?, ?)',
  args: [token, 'konto-integration']
});

console.log('✅ API token created for Konto:');
console.log(token);
