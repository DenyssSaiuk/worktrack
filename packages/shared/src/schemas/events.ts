import { z } from 'zod';

import { isoDateTime } from './common.js';
import { EVENT_TYPES, SCREENSHOT_TRIGGER_VALUES } from '../constants/index.js';

const baseEventFields = {
  clientEventId: z.string().min(8).max(128),
  timestamp: isoDateTime,
};

export const windowFocusEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.WINDOW_FOCUS),
  payload: z.object({
    processName: z.string().max(256),
    processPath: z.string().max(1024).optional(),
    windowTitle: z.string().max(512),
    pid: z.number().int().nonnegative().optional(),
  }),
});
export type WindowFocusEvent = z.infer<typeof windowFocusEvent>;

export const tabFocusEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.TAB_FOCUS),
  payload: z.object({
    browser: z.string().max(64),
    domain: z.string().max(256),
    url: z.string().url().max(2048).optional(),
    title: z.string().max(512),
    incognito: z.boolean().default(false),
  }),
});
export type TabFocusEvent = z.infer<typeof tabFocusEvent>;

export const idleStartEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.IDLE_START),
  payload: z.object({
    idleThresholdSeconds: z.number().int().positive(),
  }),
});
export type IdleStartEvent = z.infer<typeof idleStartEvent>;

export const idleEndEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.IDLE_END),
  payload: z.object({
    idleDurationSeconds: z.number().int().nonnegative(),
  }),
});
export type IdleEndEvent = z.infer<typeof idleEndEvent>;

export const privateStartEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.PRIVATE_START),
  payload: z.object({
    reason: z.string().max(64).optional(),
  }),
});
export type PrivateStartEvent = z.infer<typeof privateStartEvent>;

export const privateEndEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.PRIVATE_END),
  payload: z.object({
    durationSeconds: z.number().int().nonnegative(),
  }),
});
export type PrivateEndEvent = z.infer<typeof privateEndEvent>;

export const screenshotEvent = z.object({
  ...baseEventFields,
  type: z.literal(EVENT_TYPES.SCREENSHOT),
  payload: z.object({
    trigger: z.enum(SCREENSHOT_TRIGGER_VALUES as [string, ...string[]]),
    storageKey: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});
export type ScreenshotEvent = z.infer<typeof screenshotEvent>;

export const activityEvent = z.discriminatedUnion('type', [
  windowFocusEvent,
  tabFocusEvent,
  idleStartEvent,
  idleEndEvent,
  privateStartEvent,
  privateEndEvent,
  screenshotEvent,
]);
export type ActivityEventInput = z.infer<typeof activityEvent>;
