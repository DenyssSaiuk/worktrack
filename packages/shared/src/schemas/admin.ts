import { z } from 'zod';

import { LIMITS, PRODUCTIVITY_CATEGORY_VALUES, ROLE_VALUES } from '../constants/index.js';

export const workScheduleSchema = z.object({
  timezone: z.string().default('Europe/Kyiv'),
  hours: z.record(
    z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
});
export type WorkSchedule = z.infer<typeof workScheduleSchema>;

export const createUserRequest = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  fullName: z.string().min(1).max(256),
  role: z.enum(ROLE_VALUES as [string, ...string[]]),
  managerId: z.string().nullish(),
  workSchedule: workScheduleSchema.optional(),
});
export type CreateUserRequest = z.infer<typeof createUserRequest>;

export const updateUserRequest = createUserRequest
  .partial()
  .extend({ password: z.string().min(12).max(256).optional() });
export type UpdateUserRequest = z.infer<typeof updateUserRequest>;

export const enrollTokenResponse = z.object({
  enrollToken: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
});
export type EnrollTokenResponse = z.infer<typeof enrollTokenResponse>;

export const productivityRuleSchema = z.object({
  pattern: z.string().min(1).max(256),
  category: z.enum(PRODUCTIVITY_CATEGORY_VALUES as [string, ...string[]]),
  appliesTo: z.union([z.literal('all'), z.array(z.string()).min(1)]),
});
export type ProductivityRuleInput = z.infer<typeof productivityRuleSchema>;

export const orgSettingsSchema = z.object({
  retentionDays: z
    .number()
    .int()
    .min(LIMITS.MIN_RETENTION_DAYS)
    .max(LIMITS.MAX_RETENTION_DAYS)
    .default(LIMITS.DEFAULT_RETENTION_DAYS),
  screenshotsEnabled: z.boolean().default(false),
  screenshotTriggers: z.object({
    allowManagerRequested: z.boolean().default(true),
  }),
  defaultWorkSchedule: workScheduleSchema,
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export const exportRequest = z.object({
  userId: z.string().optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  includeScreenshots: z.boolean().default(false),
});
export type ExportRequest = z.infer<typeof exportRequest>;
