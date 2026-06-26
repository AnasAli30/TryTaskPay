/**
 * AES-256-GCM for Ed25519 private keys at rest.
 * Set `SIGNER_ENCRYPTION_SECRET` to a long random string (derived to 32 bytes via SHA-256).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function getSignerEncryptionSecret(): string | undefined {
  return process.env.SIGNER_ENCRYPTION_SECRET?.trim() || undefined;
}

/** Returns `iv:tag:ciphertext` as hex-joined base64 segments for Mongo storage. */
export function encryptEd25519PrivateKey(secret: string, privateKey32: Uint8Array): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(privateKey32)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(
    ':',
  );
}

export function decryptEd25519PrivateKey(secret: string, stored: string): Uint8Array {
  const parts = stored.split(':');
  if (parts[0] !== 'v1' || parts.length !== 4) {
    throw new Error('Invalid encrypted key format');
  }
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const data = Buffer.from(parts[3], 'base64url');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  if (out.length !== 32) {
    throw new Error('Invalid decrypted key length');
  }
  return new Uint8Array(out);
}
