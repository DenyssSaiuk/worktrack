import { z } from 'zod';

import { isoDateTime } from './common.js';
import { PRODUCTIVITY_CATEGORY_VALUES } from '../constants/index.js';

export const activitySummary = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workedMinutes: z.number().int().nonnegative(),
  idleMinutes: z.number().int().nonnegative(),
  privateMinutes: z.number().int().nonnegative(),
  productiveMinutes: z.number().int().nonnegative(),
  neutralMinutes: z.number().int().nonnegative(),
  distractingMinutes: z.number().int().nonnegative(),
  productivityScore: z.number().min(0).max(100),
});
export type ActivitySummary = z.infer<typeof activitySummary>;

export const timelineEntry = z.object({
  startedAt: isoDateTime,
  endedAt: isoDateTime,
  category: z.enum(PRODUCTIVITY_CATEGORY_VALUES as [string, ...string[]]),
  label: z.string(),
  source: z.enum(['window', 'tab', 'idle', 'private']),
});
export type TimelineEntry = z.infer<typeof timelineEntry>;

export const categoryBreakdown = z.object({
  category: z.enum(PRODUCTIVITY_CATEGORY_VALUES as [string, ...string[]]),
  minutes: z.number().int().nonnegative(),
  topItems: z
    .array(
      z.object({
        label: z.string(),
        minutes: z.number().int().nonnegative(),
      }),
    )
    .max(10),
});
export type CategoryBreakdown = z.infer<typeof categoryBreakdown>;
