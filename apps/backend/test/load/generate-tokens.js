#!/usr/bin/env node
/**
 * For each employee in the seeded org, generate an enroll token, enroll a
 * synthetic device, start a work session, and emit { agentToken, sessionId }
 * to stdout as JSON. Feed this into the k6 ingest load test:
 *
 *   node test/load/generate-tokens.js > tokens.json
 *   k6 run --env TOKENS=tokens.json test/load/ingest.k6.js
 *
 * Requires the backend running on http://localhost:7340 and an admin login.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:7340';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@acme.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'WorkTrack!Dev2026';

async function http(method, url, body, token) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const login = await http('POST', '/api/v1/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const access = login.tokens.accessToken;

  const userList = await http('GET', '/api/v1/users?pageSize=200', null, access);
  const employees = userList.items.filter((u) => u.role === 'employee');

  const out = [];
  for (const u of employees) {
    const t = await http('POST', `/api/v1/admin/users/${u.id}/enroll-token`, {}, access);
    const enroll = await http('POST', '/api/v1/auth/agent/enroll', {
      enrollToken: t.enrollToken,
      hostname: `loadtest-${u.id.slice(0, 8)}`,
      os: 'linux-x86_64',
      agentVersion: '0.1.0-load',
    });
    const session = await http(
      'POST',
      '/api/v1/ingest/session/start',
      {
        clientSessionId: `loadtest-${u.id}-${Date.now()}`,
        startedAt: new Date().toISOString(),
      },
      enroll.agentToken,
    );
    out.push({ agentToken: enroll.agentToken, sessionId: session.sessionId, userId: u.id });
  }

  mkdirSync('test/load', { recursive: true });
  writeFileSync('test/load/tokens.json', JSON.stringify(out, null, 2));
  process.stdout.write(JSON.stringify(out, null, 2));
  process.stderr.write(`\nGenerated ${out.length} agent tokens.\n`);
}

main().catch((e) => {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
});
