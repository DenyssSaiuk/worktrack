import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decrypt, deriveOrgKey, encrypt } from '../../src/lib/crypto.js';

describe('crypto', () => {
  const masterKek = randomBytes(32);

  it('encrypt/decrypt round-trip preserves plaintext', () => {
    const { key, keyId } = deriveOrgKey(masterKek, 'org_123');
    const blob = encrypt(Buffer.from('hello world'), key, keyId);
    const back = decrypt(blob, key);
    expect(back.toString('utf8')).toBe('hello world');
  });

  it('different orgs derive different keys', () => {
    const a = deriveOrgKey(masterKek, 'org_a');
    const b = deriveOrgKey(masterKek, 'org_b');
    expect(a.key.equals(b.key)).toBe(false);
  });

  it('same org + same keyId is deterministic', () => {
    const a = deriveOrgKey(masterKek, 'org_a');
    const b = deriveOrgKey(masterKek, 'org_a');
    expect(a.key.equals(b.key)).toBe(true);
    expect(a.keyId).toBe(b.keyId);
  });

  it('decrypt fails if ciphertext tampered', () => {
    const { key, keyId } = deriveOrgKey(masterKek, 'org_123');
    const blob = encrypt(Buffer.from('payload'), key, keyId);
    const tampered = {
      ...blob,
      ciphertextBase64: Buffer.from('xxxxxxxxxxxx', 'utf8').toString('base64'),
    };
    expect(() => decrypt(tampered, key)).toThrow();
  });
});
