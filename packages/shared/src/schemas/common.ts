import { z } from 'zod';

export const cuidSchema = z.string().min(1);
export const isoDateTime = z.string().datetime({ offset: true });
export const idempotencyKey = z.string().min(8).max(128);

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const dateRangeQuery = z.object({
  from: isoDateTime,
  to: isoDateTime,
});
export type DateRangeQuery = z.infer<typeof dateRangeQuery>;

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponse>;
