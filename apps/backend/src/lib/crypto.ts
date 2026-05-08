import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from 'node:crypto';

const ENC_ALGO = 'aes-256-gcm';

export interface EncryptedBlob {
  algo: typeof ENC_ALGO;
  ivBase64: string;
  tagBase64: string;
  ciphertextBase64: string;
  keyId: string;
}

/**
 * Derive a per-organization key from the master KEK using HKDF.
 * keyId labels the derived key so we can rotate the master without losing
 * data: store keyId alongside ciphertext, derive again at decrypt time.
 */
export function deriveOrgKey(
  masterKek: Buffer,
  organizationId: string,
  keyId = 'v1',
): { key: Buffer; keyId: string } {
  const info = Buffer.from(`worktrack/org/${organizationId}/${keyId}`);
  const salt = Buffer.alloc(0);
  const derived = hkdfSync('sha256', masterKek, salt, info, 32);
  return { key: Buffer.from(derived), keyId };
}

export function encrypt(plaintext: Buffer, key: Buffer, keyId: string): EncryptedBlob {
  if (key.length !== 32) throw new Error('AES-256 key must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENC_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algo: ENC_ALGO,
    ivBase64: iv.toString('base64'),
    tagBase64: tag.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    keyId,
  };
}

export function decrypt(blob: EncryptedBlob, key: Buffer): Buffer {
  if (blob.algo !== ENC_ALGO) throw new Error(`Unsupported algorithm: ${blob.algo}`);
  const iv = Buffer.from(blob.ivBase64, 'base64');
  const tag = Buffer.from(blob.tagBase64, 'base64');
  const ciphertext = Buffer.from(blob.ciphertextBase64, 'base64');
  const decipher = createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export const newId = (): string => randomUUID();
