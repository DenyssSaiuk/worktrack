import fp from 'fastify-plugin';

import { recordAudit } from '../services/audit.service.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    audit: (
      req: FastifyRequest,
      action: string,
      details?: { target?: string | null; metadata?: Record<string, unknown> | null },
    ) => Promise<void>;
  }
}

export default fp(
  async (app) => {
    app.decorate(
      'audit',
      async (
        req: FastifyRequest,
        action: string,
        details?: { target?: string | null; metadata?: Record<string, unknown> | null },
      ) => {
        try {
          await recordAudit(app.prisma, {
            organizationId: req.actor?.organizationId ?? null,
            actorId: req.actor?.id ?? null,
            action,
            target: details?.target ?? null,
            metadata: details?.metadata ?? null,
            ip: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          });
        } catch (err) {
          // Never fail the request because we couldn't write the audit log,
          // but log loudly so we notice in production.
          req.log.error({ err, action }, 'Failed to write audit log');
        }
      },
    );

    // Convenience: any non-GET response with a 2xx/3xx writes a generic audit
    // entry unless a route handler has already done so. Routes that need
    // structured payloads call `app.audit(...)` directly and disable this via
    // the `x-audit-skip` reply header.
    app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
      if (reply.statusCode >= 400) return;
      if (reply.getHeader('x-audit-skip')) return;
      await app
        .audit(req, `${req.method} ${req.routeOptions.url ?? req.url}`, {
          metadata: { statusCode: reply.statusCode },
        })
        .catch(() => undefined);
    });
  },
  { name: 'audit', dependencies: ['prisma'] },
);
