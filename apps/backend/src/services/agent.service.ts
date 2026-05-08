import { randomBytes } from 'node:crypto';

import { LIMITS } from '@worktrack/shared';

import type { Device, prisma as Prisma, WorkSession } from '@worktrack/database';
import type { ActivityEventInput } from '@worktrack/shared';

import { Errors } from '../lib/errors.js';

import type { FastifyInstance } from 'fastify';

const ENROLL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function issueEnrollToken(
  prisma: typeof Prisma,
  organizationId: string,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw Errors.notFound('User not found in this organization');
  if (user.status !== 'active') throw Errors.badRequest('Cannot enroll a non-active user');

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ENROLL_TOKEN_TTL_MS);

  await prisma.enrollToken.create({
    data: { token, organizationId, userId, expiresAt },
  });

  return { token, expiresAt };
}

export interface EnrollResult {
  agentToken: string;
  deviceId: string;
  userId: string;
  organizationId: string;
}

export async function enrollAgent(
  app: FastifyInstance,
  prisma: typeof Prisma,
  input: { enrollToken: string; hostname: string; os: string; agentVersion: string },
): Promise<EnrollResult> {
  const enrollToken = await prisma.enrollToken.findUnique({
    where: { token: input.enrollToken },
    include: { user: true },
  });
  if (!enrollToken) throw Errors.unauthorized('Invalid enrollment token');
  if (enrollToken.consumedAt) throw Errors.unauthorized('Enrollment token already used');
  if (enrollToken.expiresAt < new Date()) throw Errors.unauthorized('Enrollment token expired');
  if (enrollToken.user.status !== 'active') throw Errors.unauthorized('User not active');

  const result = await prisma.$transaction(async (tx) => {
    const device = await tx.device.create({
      data: {
        userId: enrollToken.userId,
        hostname: input.hostname,
        os: input.os,
        agentVersion: input.agentVersion,
      },
    });
    await tx.enrollToken.update({
      where: { id: enrollToken.id },
      data: { consumedAt: new Date() },
    });
    return device;
  });

  const agentToken = await app.jwt.sign(
    {
      sub: enrollToken.userId,
      deviceId: result.id,
      organizationId: enrollToken.organizationId,
      scope: 'agent',
    },
    { expiresIn: `${LIMITS.AGENT_TOKEN_TTL_SECONDS}s` },
  );

  return {
    agentToken,
    deviceId: result.id,
    userId: enrollToken.userId,
    organizationId: enrollToken.organizationId,
  };
}

export async function startSession(
  prisma: typeof Prisma,
  ctx: { userId: string; deviceId: string },
  input: { clientSessionId: string; startedAt: Date; scheduleSnapshot?: unknown },
): Promise<WorkSession> {
  const existing = await prisma.workSession.findUnique({
    where: { clientSessionId: input.clientSessionId },
  });
  if (existing) {
    if (existing.userId !== ctx.userId || existing.deviceId !== ctx.deviceId) {
      throw Errors.forbidden('clientSessionId belongs to a different device');
    }
    return existing;
  }

  return prisma.workSession.create({
    data: {
      userId: ctx.userId,
      deviceId: ctx.deviceId,
      clientSessionId: input.clientSessionId,
      startedAt: input.startedAt,
      state: 'active',
    },
  });
}

export async function endSession(
  prisma: typeof Prisma,
  ctx: { userId: string; deviceId: string },
  input: { sessionId: string; endedAt: Date; privateMinutes: number },
): Promise<WorkSession> {
  const session = await prisma.workSession.findFirst({
    where: { id: input.sessionId, userId: ctx.userId, deviceId: ctx.deviceId },
  });
  if (!session) throw Errors.notFound('Session not found');
  if (session.endedAt) return session; // idempotent

  return prisma.workSession.update({
    where: { id: session.id },
    data: { endedAt: input.endedAt, privateMinutes: input.privateMinutes, state: 'closed' },
  });
}

export interface IngestResult {
  accepted: number;
  duplicates: number;
  rejected: number;
}

export async function ingestEvents(
  prisma: typeof Prisma,
  ctx: { userId: string; deviceId: string },
  sessionId: string,
  events: ActivityEventInput[],
): Promise<IngestResult> {
  const session = await prisma.workSession.findFirst({
    where: { id: sessionId, userId: ctx.userId, deviceId: ctx.deviceId },
  });
  if (!session) throw Errors.notFound('Session not found');
  if (session.state === 'closed') throw Errors.badRequest('Session is already closed');

  // Use createMany with skipDuplicates — duplicate (sessionId, clientEventId,
  // timestamp) rows are silently dropped, giving us idempotency for retries.
  const result = await prisma.activityEvent.createMany({
    data: events.map((evt) => ({
      sessionId: session.id,
      clientEventId: evt.clientEventId,
      timestamp: new Date(evt.timestamp),
      type: evt.type,
      payload: evt.payload as never,
    })),
    skipDuplicates: true,
  });

  return {
    accepted: result.count,
    duplicates: events.length - result.count,
    rejected: 0,
  };
}

export async function heartbeat(
  prisma: typeof Prisma,
  ctx: { deviceId: string },
  input: { agentVersion: string; timestamp: Date },
): Promise<Device> {
  return prisma.device.update({
    where: { id: ctx.deviceId },
    data: { lastSeenAt: input.timestamp, agentVersion: input.agentVersion },
  });
}
