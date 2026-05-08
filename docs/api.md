# WorkTrack — API reference (v1)

All endpoints prefixed `/api/v1`. JSON in/out. Auth: `Authorization: Bearer
<jwt>` unless explicitly marked **(public)**.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public, rate-limited 5/15min | Email + password → access + refresh tokens |
| POST | `/auth/refresh` | public, rate-limited 30/min | Single-use rotation |
| POST | `/auth/logout` | user | Revoke refresh token |
| GET | `/auth/me` | user | Profile of the authenticated caller |
| POST | `/auth/agent/enroll` | public, rate-limited 30/h | Exchange enroll token → device-scoped agent JWT |
| GET | `/users` | manager+ | Paginated list of org users |
| GET | `/users/:id` | manager+ | One user |
| POST | `/users` | admin | Create user |
| PATCH | `/users/:id` | admin | Update user |
| POST | `/users/:id/suspend` | admin | Soft-suspend |
| DELETE | `/users/:id` | admin | Soft-delete |
| POST | `/admin/users/:id/enroll-token` | admin | Issue a single-use enroll token |
| POST | `/ingest/session/start` | agent | Idempotent on `clientSessionId` |
| POST | `/ingest/session/end` | agent | Idempotent |
| POST | `/ingest/events` | agent | Up to 1,000 events; deduped via `(sessionId, clientEventId, timestamp)` |
| POST | `/ingest/heartbeat` | agent | Updates `Device.lastSeenAt` |
| POST | `/ingest/screenshot` | agent | Multipart; encrypted at rest; queues AI analysis if org-enabled |
| GET | `/activity/sessions?userId=&from=&to=` | manager+ | Sessions in range |
| GET | `/activity/timeline?userId=&date=` | manager+ | Events for one day |
| GET | `/activity/summary?userId=&from=&to=` | manager+ | DailySummary rows |
| GET | `/activity/categories?userId=&date=` | manager+ | Productive/neutral/distracting + top apps & sites |
| GET | `/rules` | manager+ | Productivity rules |
| POST | `/rules` | admin | Create |
| PATCH | `/rules/:id` | admin | Update |
| DELETE | `/rules/:id` | admin | Remove |
| GET | `/organizations/me` | manager+ | Org settings |
| PATCH | `/organizations/me` | admin | Update settings (retention, screenshot/AI opt-in) |
| POST | `/exports/excel` | manager+ | Queues a BullMQ job |
| GET | `/exports/:id` | manager+ | Job status + signed download URL |
| GET | `/exports` | manager+ | Recent jobs by caller |
| GET | `/screenshots?reviewed=false` | manager+ | Review queue with short-lived signed URLs |
| POST | `/screenshots/:id/review` | manager+ | approve / flag / dismiss |
| GET | `/health` | public | Liveness |
| GET | `/ready` | public | Liveness + DB + Redis |
| GET | `/ws?token=<access JWT>` | user | WebSocket — receives `{kind: 'export' \| 'screenshot.analyzed' \| 'heartbeat'}` events for the caller's organization |

## Error format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request payload failed validation",
    "details": { "...": "..." },
    "requestId": "uuid"
  }
}
```

## Rate limit headers

When applied: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
Limits are tracked in Redis so they survive restarts and apply across
horizontally-scaled API replicas.
