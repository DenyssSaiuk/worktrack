import {
  agentEnrollRequest,
  eventBatchRequest,
  heartbeatRequest,
  sessionEndRequest,
  sessionStartRequest,
} from '@worktrack/shared';

import { Errors } from '../../lib/errors.js';
import {
  enrollAgent,
  endSession,
  heartbeat,
  ingestEvents,
  startSession,
} from '../../services/agent.service.js';

import type { FastifyInstance } from 'fastify';

export async function registerIngestRoutes(app: FastifyInstance): Promise<void> {
  // Enrollment is unauthenticated — the enroll token IS the credential.
  app.post(
    '/auth/agent/enroll',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (req) => {
      const body = agentEnrollRequest.parse(req.body);
      const result = await enrollAgent(app, app.prisma, body);
      return {
        agentToken: result.agentToken,
        deviceId: result.deviceId,
        userId: result.userId,
        organizationId: result.organizationId,
        policyVersion: '2025-01-01',
      };
    },
  );

  app.register(
    async (instance) => {
      // All routes below require an agent token.
      instance.addHook('preHandler', instance.requireAgent());

      instance.post('/session/start', async (req) => {
        if (!req.actor || req.actor.scope !== 'agent') throw Errors.forbidden();
        const body = sessionStartRequest.parse(req.body);
        const session = await startSession(
          app.prisma,
          { userId: req.actor.id, deviceId: req.actor.deviceId! },
          {
            clientSessionId: body.clientSessionId,
            startedAt: new Date(body.startedAt),
            scheduleSnapshot: body.scheduleSnapshot,
          },
        );
        return { sessionId: session.id };
      });

      instance.post('/session/end', async (req) => {
        if (!req.actor || req.actor.scope !== 'agent') throw Errors.forbidden();
        const body = sessionEndRequest.parse(req.body);
        const session = await endSession(
          app.prisma,
          { userId: req.actor.id, deviceId: req.actor.deviceId! },
          {
            sessionId: body.sessionId,
            endedAt: new Date(body.endedAt),
            privateMinutes: body.privateMinutes,
          },
        );
        return { sessionId: session.id, endedAt: session.endedAt };
      });

      instance.post('/events', async (req, reply) => {
        if (!req.actor || req.actor.scope !== 'agent') throw Errors.forbidden();
        const body = eventBatchRequest.parse(req.body);
        const result = await ingestEvents(
          app.prisma,
          { userId: req.actor.id, deviceId: req.actor.deviceId! },
          body.sessionId,
          body.events,
        );
        // High-volume endpoint: skip the generic audit hook to keep the
        // table small and the request fast.
        reply.header('x-audit-skip', '1');
        return result;
      });

      instance.post('/heartbeat', async (req, reply) => {
        if (!req.actor || req.actor.scope !== 'agent') throw Errors.forbidden();
        const body = heartbeatRequest.parse(req.body);
        await heartbeat(
          app.prisma,
          { deviceId: req.actor.deviceId! },
          {
            agentVersion: body.agentVersion,
            timestamp: new Date(body.timestamp),
          },
        );
        reply.header('x-audit-skip', '1');
        return { ok: true };
      });
    },
    { prefix: '/ingest' },
  );
}
