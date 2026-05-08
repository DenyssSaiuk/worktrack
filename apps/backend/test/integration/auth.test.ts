/**
 * Integration tests for the auth flow. These require:
 *   - Postgres on DATABASE_URL
 *   - Redis on REDIS_URL
 *   - JWT key files at JWT_*_KEY_PATH
 * They are skipped automatically when those preconditions are not met.
 */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { resetConfigForTests } from '../../src/config.js';

import type { FastifyInstance } from 'fastify';

const haveDb = !!process.env.DATABASE_URL;
const haveRedis = !!process.env.REDIS_URL;
const skip = !haveDb || !haveRedis;

const describeIntegration = skip ? describe.skip : describe;

describeIntegration('auth flow', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ensureJwtKeys();
    resetConfigForTests();
    app = await buildApp({ logger: { level: 'error' } });
    await app.ready();
    // Clear stale rate-limit counters from prior test runs.
    await app.redis.flushdb();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects bad password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.test', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('logs in, fetches /me, refreshes, logs out', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.test', password: 'WorkTrack!Dev2026' },
    });
    expect(login.statusCode).toBe(200);
    const loginBody = login.json();
    const access1 = loginBody.tokens.accessToken;
    const refresh1 = loginBody.tokens.refreshToken;
    expect(access1).toBeTypeOf('string');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${access1}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('admin@acme.test');

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: refresh1 },
    });
    expect(refreshed.statusCode).toBe(200);
    const refresh2 = refreshed.json().tokens.refreshToken;
    expect(refresh2).not.toBe(refresh1);

    // Old refresh token must now be rejected (single-use rotation).
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: refresh1 },
    });
    expect(replay.statusCode).toBe(401);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: refresh2 },
    });
    expect(logout.statusCode).toBe(200);
  });

  it('rejects /me without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

function ensureJwtKeys(): void {
  const root = resolve(process.cwd(), '../..');
  const dir = resolve(root, 'secrets');
  const priv = resolve(dir, 'jwt-private.pem');
  const pub = resolve(dir, 'jwt-public.pem');
  if (existsSync(priv) && existsSync(pub)) return;
  mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(priv, privateKey.export({ type: 'pkcs1', format: 'pem' }) as string);
  writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }) as string);
}
