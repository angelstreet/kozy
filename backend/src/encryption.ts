import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';

/**
 * Load encryption key from system.env file
 * Falls back to environment variable if file doesn't exist
 */
function loadEncryptionKey(): Buffer {
  // Try to load from system secrets file first
  const secretsPath = path.join(process.env.HOME || '/root', '.openclaw', 'secrets', 'system.env');
  
  if (fs.existsSync(secretsPath)) {
    const secretsContent = fs.readFileSync(secretsPath, 'utf-8');
    const match = secretsContent.match(/ENCRYPTION_KEY=([0-9a-f]{64})/);
    if (match) {
      return Buffer.from(match[1], 'hex');
    }
  }
  
  // Fallback to environment variable
  if (process.env.ENCRYPTION_KEY) {
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  
  throw new Error('ENCRYPTION_KEY not found in ~/.openclaw/secrets/system.env or environment');
}

const KEY = loadEncryptionKey();

/**
 * Encrypt a plaintext API key using AES-256-GCM
 * @param plaintext - The plaintext API key to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted" (all hex-encoded)
 */
export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted API key using AES-256-GCM
 * @param encrypted - Encrypted string in format "iv:authTag:encrypted"
 * @returns Decrypted plaintext API key
 */
export function decryptApiKey(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
}
