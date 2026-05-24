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

  /**
   * Snapshot presence for everyone in the org. A user counts as online if
   * any of their devices reported a heartbeat in the last 90 seconds (one
   * missed beat of grace for the 30 s client cadence).
   */
  app.get('/presence', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const cutoff = new Date(Date.now() - 90 * 1000);
    const users = await app.prisma.user.findMany({
      where: { organizationId: req.actor.organizationId },
      select: {
        id: true,
        devices: {
          select: { lastSeenAt: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 1,
        },
      },
    });
    return users.map((u) => {
      const lastSeen = u.devices[0]?.lastSeenAt ?? null;
      return {
        userId: u.id,
        lastSeenAt: lastSeen?.toISOString() ?? null,
        online: !!lastSeen && lastSeen >= cutoff,
      };
    });
  });
}
