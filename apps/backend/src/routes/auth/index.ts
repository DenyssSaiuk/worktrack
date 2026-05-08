import { loginRequest, refreshRequest } from '@worktrack/shared';

import { Errors } from '../../lib/errors.js';
import {
  loginWithPassword,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../services/auth.service.js';

import type { FastifyInstance } from 'fastify';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/login',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '15 minutes' },
      },
    },
    async (req) => {
      const body = loginRequest.parse(req.body);
      const result = await loginWithPassword(app, app.prisma, app.redis, body.email, body.password);

      await app.audit(req, 'auth.login', {
        target: result.user.id,
        metadata: { email: result.user.email },
      });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          organizationId: result.user.organizationId,
        },
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  app.post(
    '/refresh',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      const body = refreshRequest.parse(req.body);
      const result = await rotateRefreshToken(app, app.prisma, app.redis, body.refreshToken);
      return {
        user: result.user,
        tokens: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    },
  );

  app.post('/logout', async (req, reply) => {
    const body = (req.body ?? {}) as { refreshToken?: string };
    if (!body.refreshToken) throw Errors.badRequest('refreshToken is required');
    await revokeRefreshToken(app, app.redis, body.refreshToken);
    reply.header('x-audit-skip', '1');
    await app.audit(req, 'auth.logout');
    return { ok: true };
  });

  app.get('/me', { preHandler: app.requireUser() }, async (req) => {
    if (!req.actor || req.actor.scope !== 'user') throw Errors.unauthorized();
    const user = await app.prisma.user.findUnique({ where: { id: req.actor.id } });
    if (!user) throw Errors.unauthorized();
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
      consentVersion: user.consentVersion,
      consentAt: user.consentAt,
      workSchedule: user.workSchedule,
    };
  });
}
