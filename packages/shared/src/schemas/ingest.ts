import { z } from 'zod';

import { isoDateTime } from './common.js';
import { activityEvent } from './events.js';
import { LIMITS } from '../constants/index.js';

export const sessionStartRequest = z.object({
  clientSessionId: z.string().min(8).max(128),
  startedAt: isoDateTime,
  scheduleSnapshot: z
    .object({
      timezone: z.string(),
      hours: z.record(
        z.string(),
        z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        }),
      ),
    })
    .optional(),
});
export type SessionStartRequest = z.infer<typeof sessionStartRequest>;

export const sessionStartResponse = z.object({
  sessionId: z.string(),
});
export type SessionStartResponse = z.infer<typeof sessionStartResponse>;

export const sessionEndRequest = z.object({
  sessionId: z.string(),
  endedAt: isoDateTime,
  privateMinutes: z.number().int().nonnegative().default(0),
});
export type SessionEndRequest = z.infer<typeof sessionEndRequest>;

export const eventBatchRequest = z.object({
  sessionId: z.string(),
  events: z.array(activityEvent).min(1).max(LIMITS.MAX_EVENTS_PER_BATCH),
});
export type EventBatchRequest = z.infer<typeof eventBatchRequest>;

export const eventBatchResponse = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
});
export type EventBatchResponse = z.infer<typeof eventBatchResponse>;

export const heartbeatRequest = z.object({
  sessionId: z.string().optional(),
  timestamp: isoDateTime,
  agentVersion: z.string().min(1).max(32),
  inPrivateSession: z.boolean().default(false),
  bufferedEventCount: z.number().int().nonnegative().default(0),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequest>;
