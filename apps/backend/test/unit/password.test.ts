import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/services/auth.service.js';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const digest = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', digest)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const digest = await hashPassword('one');
    expect(await verifyPassword('two', digest)).toBe(false);
  });

  it('produces different digests for the same input (salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
