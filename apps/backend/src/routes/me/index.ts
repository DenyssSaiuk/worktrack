/**
 * Web-only worker endpoints, mounted at /api/v1/me.
 *
 * These let an employee start / stop their workday, push activity events,
 * and heartbeat directly from a browser session — no desktop agent or
 * enrollment token required. Authentication is the same httpOnly cookie
 * the dashboard uses (user-scoped JWT).
 */
import { randomBytes } from 'node:crypto';

import { eventBatchRequest } from '@worktrack/shared';
import { z } from 'zod';

import { Errors } from '../../lib/errors.js';
import { endSession, heartbeat, ingestEvents, startSession } from '../../services/agent.service.js';
import { broadcast } from '../ws.js';

import type { FastifyInstance } from 'fastify';

const eventsBody = z.object({
  events: eventBatchRequest.shape.events,
});

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  // All routes require a logged-in user of any role.
  app.addHook('preHandler', app.requireUser());

  /**
   * Return the current workday status for the caller.
   *
   * Response: `{ active: false }` if no open session, otherwise
   * `{ active: true, sessionId, startedAt, deviceId }`.
   */
  app.get('/workday', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const session = await app.prisma.workSession.findFirst({
      where: { userId: req.actor.id, state: 'active', endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return { active: false };
    return {
      active: true,
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      deviceId: session.deviceId,
    };
  });

  /**
   * Start (or resume) a workday from the browser. Idempotent: if an
   * active session already exists for this user, returns it instead of
   * creating a second one.
   */
  app.post('/workday/start', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const existing = await app.prisma.workSession.findFirst({
      where: { userId: req.actor.id, state: 'active', endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      return {
        sessionId: existing.id,
        startedAt: existing.startedAt.toISOString(),
        deviceId: existing.deviceId,
        resumed: true,
      };
    }

    const device = await getOrCreateBrowserDevice(
      app,
      req.actor.id,
      req.headers['user-agent'] ?? 'unknown-browser',
    );

    const session = await startSession(
      app.prisma,
      { userId: req.actor.id, deviceId: device.id },
      {
        clientSessionId: `web-${req.actor.id}-${randomBytes(8).toString('hex')}`,
        startedAt: new Date(),
      },
    );

    return {
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      deviceId: device.id,
      resumed: false,
    };
  });

  /**
   * End the user's current workday. Idempotent.
   */
  app.post('/workday/end', async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const session = await app.prisma.workSession.findFirst({
      where: { userId: req.actor.id, state: 'active', endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return { ended: false };
    const closed = await endSession(
      app.prisma,
      { userId: req.actor.id, deviceId: session.deviceId },
      { sessionId: session.id, endedAt: new Date(), privateMinutes: 0 },
    );
    return {
      ended: true,
      sessionId: closed.id,
      endedAt: closed.endedAt?.toISOString() ?? null,
    };
  });

  /**
   * Lightweight heartbeat — updates the browser device's lastSeenAt so
   * the Live dashboard can show the worker as online.
   */
  app.post('/heartbeat', async (req, reply) => {
    if (!req.actor) throw Errors.unauthorized();
    const device = await app.prisma.device.findFirst({
      where: { userId: req.actor.id, hostname: { startsWith: 'browser:' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!device) return { ok: true, noDevice: true };
    await heartbeat(
      app.prisma,
      { deviceId: device.id },
      { agentVersion: device.agentVersion, timestamp: new Date() },
    );
    broadcast(req.actor.organizationId, {
      kind: 'heartbeat',
      userId: req.actor.id,
      online: true,
      inPrivateSession: false,
    });
    reply.header('x-audit-skip', '1');
    return { ok: true };
  });

  /**
   * Push a batch of activity events for the caller's active session.
   * sessionId is derived from the user; the client doesn't pass it.
   */
  app.post('/events', async (req, reply) => {
    if (!req.actor) throw Errors.unauthorized();
    const body = eventsBody.parse(req.body);
    const session = await app.prisma.workSession.findFirst({
      where: { userId: req.actor.id, state: 'active', endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) throw Errors.badRequest('No active workday — call /workday/start first');
    const result = await ingestEvents(
      app.prisma,
      { userId: req.actor.id, deviceId: session.deviceId },
      session.id,
      body.events,
    );
    reply.header('x-audit-skip', '1');
    return { sessionId: session.id, ...result };
  });
}

/**
 * Find (or lazily create) the browser "device" for this user.
 * We use the hostname prefix `browser:` to distinguish web sessions from
 * desktop Tauri agent installs.
 */
async function getOrCreateBrowserDevice(
  app: FastifyInstance,
  userId: string,
  userAgent: string,
): Promise<{ id: string }> {
  const existing = await app.prisma.device.findFirst({
    where: { userId, hostname: { startsWith: 'browser:' } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await app.prisma.device.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return existing;
  }
  const ua = userAgent.slice(0, 200);
  return app.prisma.device.create({
    data: {
      userId,
      hostname: `browser:${ua.split(' ')[0] ?? 'web'}`,
      os: detectOsFromUserAgent(ua),
      agentVersion: 'web/1.0',
      lastSeenAt: new Date(),
    },
  });
}

function detectOsFromUserAgent(ua: string): string {
  if (/Windows/i.test(ua)) return 'web-windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'web-macos';
  if (/Linux/i.test(ua)) return 'web-linux';
  if (/Android/i.test(ua)) return 'web-android';
  if (/iPhone|iPad|iOS/i.test(ua)) return 'web-ios';
  return 'web-unknown';
}
