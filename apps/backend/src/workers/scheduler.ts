import { QUEUE_NAMES, createQueue, buildConnection } from './queues.js';

import type { Queue, ConnectionOptions } from 'bullmq';
import type { Logger } from 'pino';

export interface Schedulers {
  connection: ConnectionOptions;
  aggregateDailyQueue: Queue;
  close(): Promise<void>;
}

export async function startSchedulers(redisUrl: string, log: Logger): Promise<Schedulers> {
  const connection = buildConnection(redisUrl);
  const aggregateDailyQueue = createQueue(QUEUE_NAMES.AGGREGATE_DAILY, connection);

  await aggregateDailyQueue.upsertJobScheduler(
    'daily-aggregate',
    { pattern: '5 0 * * *', tz: 'UTC' },
    {
      name: 'daily-aggregate',
      data: { date: yesterdayUtcIsoDate() },
      opts: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    },
  );
  log.info('Scheduler initialized: daily-aggregate cron 00:05 UTC');

  return {
    connection,
    aggregateDailyQueue,
    async close() {
      await aggregateDailyQueue.close();
    },
  };
}

function yesterdayUtcIsoDate(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
