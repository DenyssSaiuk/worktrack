import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { resetConfigForTests } from '../../src/config.js';

import type { FastifyInstance } from 'fastify';

const haveDb = !!process.env.DATABASE_URL;
const haveRedis = !!process.env.REDIS_URL;
const skip = !haveDb || !haveRedis;
const describeIntegration = skip ? describe.skip : describe;

describeIntegration('ingest flow', () => {
  let app: FastifyInstance;
  let adminAccessToken: string;

  beforeAll(async () => {
    ensureJwtKeys();
    resetConfigForTests();
    app = await buildApp({ logger: { level: 'error' } });
    await app.ready();
    await app.redis.flushdb();

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@acme.test', password: 'WorkTrack!Dev2026' },
    });
    expect(login.statusCode).toBe(200);
    adminAccessToken = login.json().tokens.accessToken;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('end-to-end: enroll → start session → ingest events → end session', async () => {
    const employee = await app.prisma.user.findFirstOrThrow({
      where: { email: 'employee1@acme.test' },
    });

    const tokenRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${employee.id}/enroll-token`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(tokenRes.statusCode).toBe(200);
    const enrollToken = tokenRes.json().enrollToken;

    const enroll = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/agent/enroll',
      payload: {
        enrollToken,
        hostname: 'EMPLOYEE1-LAPTOP',
        os: 'windows-11',
        agentVersion: '0.1.0-test',
      },
    });
    expect(enroll.statusCode).toBe(200);
    const { agentToken, deviceId } = enroll.json();
    expect(agentToken).toBeTypeOf('string');
    expect(deviceId).toBeTypeOf('string');

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/agent/enroll',
      payload: {
        enrollToken,
        hostname: 'X',
        os: 'X',
        agentVersion: 'X',
      },
    });
    expect(replay.statusCode).toBe(401);

    const sessionStart = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/session/start',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: {
        clientSessionId: `test-session-${Date.now()}`,
        startedAt: new Date().toISOString(),
      },
    });
    expect(sessionStart.statusCode).toBe(200);
    const sessionId = sessionStart.json().sessionId;

    const events = [
      {
        clientEventId: 'evt-test-0001',
        timestamp: new Date().toISOString(),
        type: 'window_focus',
        payload: { processName: 'Code.exe', windowTitle: 'index.ts' },
      },
      {
        clientEventId: 'evt-test-0002',
        timestamp: new Date(Date.now() + 1000).toISOString(),
        type: 'tab_focus',
        payload: { browser: 'chrome', domain: 'github.com', title: 'PR #42', incognito: false },
      },
    ];

    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/events',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { sessionId, events },
    });
    expect(ingest.statusCode).toBe(200);
    expect(ingest.json().accepted).toBe(2);

    // Replay must dedupe.
    const replay2 = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/events',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { sessionId, events },
    });
    expect(replay2.statusCode).toBe(200);
    expect(replay2.json().accepted).toBe(0);
    expect(replay2.json().duplicates).toBe(2);

    const heartbeat = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/heartbeat',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: {
        timestamp: new Date().toISOString(),
        agentVersion: '0.1.0-test',
        inPrivateSession: false,
        bufferedEventCount: 0,
      },
    });
    expect(heartbeat.statusCode).toBe(200);

    const sessionEnd = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/session/end',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { sessionId, endedAt: new Date().toISOString(), privateMinutes: 0 },
    });
    expect(sessionEnd.statusCode).toBe(200);

    // After close, further event ingestion is rejected.
    const afterClose = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/events',
      headers: { authorization: `Bearer ${agentToken}` },
      payload: {
        sessionId,
        events: [
          {
            clientEventId: 'evt-test-0003',
            timestamp: new Date().toISOString(),
            type: 'idle_start',
            payload: { idleThresholdSeconds: 60 },
          },
        ],
      },
    });
    expect(afterClose.statusCode).toBe(400);
  });

  it('rejects user tokens on agent endpoints', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/heartbeat',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: {
        timestamp: new Date().toISOString(),
        agentVersion: '0.1.0-test',
        inPrivateSession: false,
        bufferedEventCount: 0,
      },
    });
    expect(res.statusCode).toBe(403);
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
