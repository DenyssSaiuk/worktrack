import type { prisma as Prisma } from '@worktrack/database';

import { Errors } from '../lib/errors.js';

export async function listSessions(
  prisma: typeof Prisma,
  organizationId: string,
  filter: { userId?: string; from: Date; to: Date },
): Promise<unknown[]> {
  await assertSameOrg(prisma, organizationId, filter.userId);
  return prisma.workSession.findMany({
    where: {
      user: { organizationId },
      ...(filter.userId ? { userId: filter.userId } : {}),
      startedAt: { gte: filter.from, lte: filter.to },
    },
    orderBy: { startedAt: 'desc' },
    include: { user: { select: { id: true, fullName: true, email: true } } },
    take: 500,
  });
}

export async function timeline(
  prisma: typeof Prisma,
  organizationId: string,
  userId: string,
  date: Date,
): Promise<unknown> {
  await assertSameOrg(prisma, organizationId, userId);
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const events = await prisma.activityEvent.findMany({
    where: {
      timestamp: { gte: dayStart, lt: dayEnd },
      session: { userId },
    },
    orderBy: { timestamp: 'asc' },
    take: 5_000,
  });
  return { date: dayStart.toISOString(), count: events.length, events };
}

export async function summary(
  prisma: typeof Prisma,
  organizationId: string,
  userId: string,
  from: Date,
  to: Date,
): Promise<unknown> {
  await assertSameOrg(prisma, organizationId, userId);
  return prisma.dailySummary.findMany({
    where: {
      userId,
      date: { gte: stripTime(from), lte: stripTime(to) },
    },
    orderBy: { date: 'asc' },
  });
}

export async function categories(
  prisma: typeof Prisma,
  organizationId: string,
  userId: string,
  date: Date,
): Promise<unknown> {
  await assertSameOrg(prisma, organizationId, userId);
  const day = stripTime(date);
  const summaryRow = await prisma.dailySummary.findUnique({
    where: { userId_date: { userId, date: day } },
  });
  if (!summaryRow) {
    return {
      productiveMinutes: 0,
      neutralMinutes: 0,
      distractingMinutes: 0,
      topApps: [],
      topSites: [],
    };
  }
  return {
    productiveMinutes: summaryRow.productiveMinutes,
    neutralMinutes: summaryRow.neutralMinutes,
    distractingMinutes: summaryRow.distractingMinutes,
    topApps: summaryRow.topApps,
    topSites: summaryRow.topSites,
  };
}

async function assertSameOrg(
  prisma: typeof Prisma,
  organizationId: string,
  userId?: string,
): Promise<void> {
  if (!userId) return;
  const u = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!u) throw Errors.notFound('User not found in this organization');
}

function stripTime(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
