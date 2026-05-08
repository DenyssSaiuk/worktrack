import { ROLES } from '@worktrack/shared';
import { z } from 'zod';

import { Errors } from '../../lib/errors.js';
import { issueEnrollToken } from '../../services/agent.service.js';

import type { FastifyInstance } from 'fastify';

const idParam = z.object({ id: z.string().min(1) });

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/users/:id/enroll-token', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const result = await issueEnrollToken(app.prisma, req.actor.organizationId, id);
    await app.audit(req, 'agent.enroll-token.issue', { target: id });
    return { enrollToken: result.token, expiresAt: result.expiresAt.toISOString() };
  });
}
