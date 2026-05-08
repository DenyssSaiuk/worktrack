import { productivityRuleSchema, ROLES } from '@worktrack/shared';
import { z } from 'zod';

import { Errors } from '../../lib/errors.js';

import type { FastifyInstance } from 'fastify';

const idParam = z.object({ id: z.string().min(1) });

export async function registerRulesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    return app.prisma.productivityRule.findMany({
      where: { organizationId: req.actor.organizationId },
      orderBy: [{ category: 'asc' }, { pattern: 'asc' }],
    });
  });

  app.post('/', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const body = productivityRuleSchema.parse(req.body);
    const rule = await app.prisma.productivityRule.create({
      data: {
        organizationId: req.actor.organizationId,
        pattern: body.pattern,
        category: body.category,
        appliesTo: body.appliesTo as never,
      },
    });
    await app.audit(req, 'rule.create', { target: rule.id });
    return rule;
  });

  app.patch('/:id', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const body = productivityRuleSchema.partial().parse(req.body);
    const existing = await app.prisma.productivityRule.findFirst({
      where: { id, organizationId: req.actor.organizationId },
    });
    if (!existing) throw Errors.notFound('Rule not found');
    const rule = await app.prisma.productivityRule.update({
      where: { id },
      data: {
        ...(body.pattern && { pattern: body.pattern }),
        ...(body.category && { category: body.category }),
        ...(body.appliesTo && { appliesTo: body.appliesTo as never }),
      },
    });
    await app.audit(req, 'rule.update', { target: id });
    return rule;
  });

  app.delete('/:id', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const existing = await app.prisma.productivityRule.findFirst({
      where: { id, organizationId: req.actor.organizationId },
    });
    if (!existing) throw Errors.notFound('Rule not found');
    await app.prisma.productivityRule.delete({ where: { id } });
    await app.audit(req, 'rule.delete', { target: id });
    return { ok: true };
  });
}
