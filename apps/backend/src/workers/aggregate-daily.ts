import { prisma } from '@worktrack/database';
import { EVENT_TYPES, PRODUCTIVITY_CATEGORIES } from '@worktrack/shared';
import { Worker } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from './queues.js';

import type { ConnectionOptions } from 'bullmq';
import type { Logger } from 'pino';

interface AggregateJobData {
  date: string; // ISO date YYYY-MM-DD, the day to aggregate (UTC)
  userId?: string; // if absent, aggregate for everyone
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startAggregateDailyWorker(
  connection: ConnectionOptions,
  log: Logger,
): Worker<AggregateJobData> {
  return new Worker<AggregateJobData>(
    QUEUE_NAMES.AGGREGATE_DAILY,
    async (job) => {
      const date = new Date(`${job.data.date}T00:00:00.000Z`);
      const next = new Date(date.getTime() + DAY_MS);
      log.info({ date: job.data.date, userId: job.data.userId }, 'aggregate-daily start');

      const userIds = job.data.userId
        ? [job.data.userId]
        : (
            await prisma.user.findMany({
              where: { status: 'active' },
              select: { id: true },
            })
          ).map((u) => u.id);

      for (const userId of userIds) {
        const sessions = await prisma.workSession.findMany({
          where: {
            userId,
            startedAt: { lt: next },
            OR: [{ endedAt: null }, { endedAt: { gte: date } }],
          },
          include: { events: true },
        });

        let workedMinutes = 0;
        let idleMinutes = 0;
        let privateMinutes = 0;
        let productiveMinutes = 0;
        let neutralMinutes = 0;
        let distractingMinutes = 0;
        const appHits = new Map<string, number>();
        const siteHits = new Map<string, number>();

        const rules = await prisma.productivityRule.findMany({
          where: {
            organization: { users: { some: { id: userId } } },
          },
        });

        const categorize = (label: string): string => {
          for (const rule of rules) {
            const applies =
              rule.appliesTo === 'all' ||
              (Array.isArray(rule.appliesTo) && (rule.appliesTo as string[]).includes(userId));
            if (applies && label.toLowerCase().includes(rule.pattern.toLowerCase())) {
              return rule.category;
            }
          }
          return PRODUCTIVITY_CATEGORIES.NEUTRAL;
        };

        for (const session of sessions) {
          const start = session.startedAt < date ? date : session.startedAt;
          const end = session.endedAt && session.endedAt < next ? session.endedAt : next;
          const sessionMinutes = Math.max(
            0,
            Math.round((end.getTime() - start.getTime()) / 60_000),
          );
          workedMinutes += sessionMinutes;
          privateMinutes += session.privateMinutes;

          for (const evt of session.events) {
            if (evt.timestamp < date || evt.timestamp >= next) continue;
            const payload = evt.payload as Record<string, unknown>;

            if (evt.type === EVENT_TYPES.IDLE_END) {
              idleMinutes += Math.round(((payload.idleDurationSeconds as number) ?? 0) / 60);
            } else if (evt.type === EVENT_TYPES.WINDOW_FOCUS) {
              const name = String(payload.processName ?? 'unknown');
              appHits.set(name, (appHits.get(name) ?? 0) + 1);
              const cat = categorize(name);
              if (cat === PRODUCTIVITY_CATEGORIES.PRODUCTIVE) productiveMinutes += 1;
              else if (cat === PRODUCTIVITY_CATEGORIES.DISTRACTING) distractingMinutes += 1;
              else neutralMinutes += 1;
            } else if (evt.type === EVENT_TYPES.TAB_FOCUS) {
              const domain = String(payload.domain ?? 'unknown');
              siteHits.set(domain, (siteHits.get(domain) ?? 0) + 1);
              const cat = categorize(domain);
              if (cat === PRODUCTIVITY_CATEGORIES.PRODUCTIVE) productiveMinutes += 1;
              else if (cat === PRODUCTIVITY_CATEGORIES.DISTRACTING) distractingMinutes += 1;
              else neutralMinutes += 1;
            }
          }
        }

        const totalCategorized = productiveMinutes + neutralMinutes + distractingMinutes;
        const productivityScore =
          totalCategorized === 0 ? 0 : Math.round((productiveMinutes / totalCategorized) * 100);

        await prisma.dailySummary.upsert({
          where: { userId_date: { userId, date } },
          create: {
            userId,
            date,
            workedMinutes,
            idleMinutes,
            privateMinutes,
            productiveMinutes,
            neutralMinutes,
            distractingMinutes,
            productivityScore,
            topApps: topN(appHits, 10) as never,
            topSites: topN(siteHits, 10) as never,
          },
          update: {
            workedMinutes,
            idleMinutes,
            privateMinutes,
            productiveMinutes,
            neutralMinutes,
            distractingMinutes,
            productivityScore,
            topApps: topN(appHits, 10) as never,
            topSites: topN(siteHits, 10) as never,
            computedAt: new Date(),
          },
        });
      }

      log.info({ date: job.data.date, userCount: userIds.length }, 'aggregate-daily done');
      return { userCount: userIds.length };
    },
    { connection, concurrency: 1 },
  );
}

export function getQueueName(): QueueName {
  return QUEUE_NAMES.AGGREGATE_DAILY;
}

function topN(map: Map<string, number>, n: number): Array<{ label: string; minutes: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, minutes]) => ({ label, minutes }));
}

export type { AggregateJobData };
