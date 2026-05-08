import { z } from 'zod';

import { Errors } from '../../lib/errors.js';
import { categories, listSessions, summary, timeline } from '../../services/activity.service.js';

import type { FastifyInstance } from 'fastify';

const sessionsQuery = z.object({
  userId: z.string().optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

const userDateQuery = z.object({
  userId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const summaryQuery = z.object({
  userId: z.string(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireUser('admin', 'manager'));

  app.get('/sessions', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const q = sessionsQuery.parse(req.query);
    const filter: { userId?: string; from: Date; to: Date } = {
      from: new Date(q.from),
      to: new Date(q.to),
    };
    if (q.userId) filter.userId = q.userId;
    return listSessions(app.prisma, req.actor.organizationId, filter);
  });

  app.get('/timeline', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const q = userDateQuery.parse(req.query);
    return timeline(
      app.prisma,
      req.actor.organizationId,
      q.userId,
      new Date(`${q.date}T00:00:00Z`),
    );
  });

  app.get('/summary', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const q = summaryQuery.parse(req.query);
    return summary(
      app.prisma,
      req.actor.organizationId,
      q.userId,
      new Date(q.from),
      new Date(q.to),
    );
  });

  app.get('/categories', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const q = userDateQuery.parse(req.query);
    return categories(
      app.prisma,
      req.actor.organizationId,
      q.userId,
      new Date(`${q.date}T00:00:00Z`),
    );
  });
}
