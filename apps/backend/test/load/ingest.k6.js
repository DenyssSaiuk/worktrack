/* global __ENV */
// k6 load test: 500 simulated agents POST 100 events every 30s.
//
// Pre-flight (one-time):
//   1. Spin up Postgres + Redis: `docker compose up -d`
//   2. Run migrations + seed: `pnpm db:migrate:deploy && pnpm db:seed`
//   3. Start backend: `pnpm --filter @worktrack/backend run dev`
//   4. Generate enrolled-agent tokens via the backend admin UI or:
//        node test/load/generate-tokens.js > tokens.json
//      The script issues an enroll-token + enrolls a synthetic device per
//      employee, writing { agentToken, sessionId } pairs to disk.
//   5. Run k6: `k6 run --env TOKENS=tokens.json --env BASE=http://localhost:7340 test/load/ingest.k6.js`
//
// Pass criteria: error rate < 1%, p(95) < 250ms.
import http from 'k6/http';
import { check, sleep } from 'k6';

const TOKENS = JSON.parse(open(__ENV.TOKENS || './tokens.json'));
const BASE = __ENV.BASE || 'http://localhost:7340';

export const options = {
  scenarios: {
    agents: {
      executor: 'constant-vus',
      vus: 500,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<250'],
  },
};

function makeBatch(size) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < size; i++) {
    out.push({
      clientEventId: `k6-${__ENV.K6_VU || '0'}-${now}-${i}`,
      timestamp: new Date(now - i * 100).toISOString(),
      type: 'window_focus',
      payload: { processName: 'Code.exe', windowTitle: 'load test' },
    });
  }
  return out;
}

export default function () {
  // eslint-disable-next-line no-undef
  const idx = (typeof __VU === 'number' ? __VU - 1 : 0) % TOKENS.length;
  const cred = TOKENS[idx];
  const res = http.post(
    `${BASE}/api/v1/ingest/events`,
    JSON.stringify({ sessionId: cred.sessionId, events: makeBatch(100) }),
    {
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cred.agentToken}` },
    },
  );
  check(res, { '200 OK': (r) => r.status === 200 });
  sleep(30);
}
