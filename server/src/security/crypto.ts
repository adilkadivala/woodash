import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * AES-256-GCM encryption for upstream server credentials.
 *
 * Encrypted format: iv (12 bytes) || authTag (16 bytes) || ciphertext
 * The encryption key is derived from the CREDENTIAL_ENC_KEY env var.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length

/**
 * Get the 32-byte encryption key from config.
 */
function getKey(): Buffer {
  const keyHex = config.CREDENTIAL_ENC_KEY;
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error(`CREDENTIAL_ENC_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }
  return key;
}

/**
 * Encrypt a credential string using AES-256-GCM.
 * Returns a Buffer containing: iv (12 bytes) || authTag (16 bytes) || ciphertext
 */
export function encryptCredential(plaintext: string): Uint8Array {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv || authTag || ciphertext
  return new Uint8Array(Buffer.concat([iv, authTag, encrypted]));
}

/**
 * Decrypt a credential that was encrypted with encryptCredential.
 * Expects a Buffer in the format: iv (12 bytes) || authTag (16 bytes) || ciphertext
 */
export function decryptCredential(encrypted: Uint8Array): string {
  const buf = Buffer.from(encrypted);
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Encrypted credential is too short to be valid');
  }

  const key = getKey();

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
