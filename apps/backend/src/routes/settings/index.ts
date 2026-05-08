import { orgSettingsSchema, ROLES } from '@worktrack/shared';

import { Errors } from '../../lib/errors.js';

import type { FastifyInstance } from 'fastify';

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/me', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const org = await app.prisma.organization.findUnique({
      where: { id: req.actor.organizationId },
    });
    if (!org) throw Errors.notFound();
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      retentionDays: org.retentionDays,
      settings: org.settings,
    };
  });

  app.patch('/me', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const body = orgSettingsSchema.partial().parse(req.body);
    const org = await app.prisma.organization.update({
      where: { id: req.actor.organizationId },
      data: {
        ...(body.retentionDays !== undefined && { retentionDays: body.retentionDays }),
        settings: body as never,
      },
    });
    await app.audit(req, 'settings.update', { target: req.actor.organizationId });
    return {
      id: org.id,
      name: org.name,
      retentionDays: org.retentionDays,
      settings: org.settings,
    };
  });
}
