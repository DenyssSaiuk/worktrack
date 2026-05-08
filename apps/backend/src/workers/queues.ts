import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

export const QUEUE_NAMES = {
  AGGREGATE_DAILY: 'aggregate-daily',
  EXCEL_EXPORT: 'excel-export',
  ANALYZE_SCREENSHOT: 'analyze-screenshot',
  RETENTION_CLEANUP: 'retention-cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function buildConnection(redisUrl: string): ConnectionOptions {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function createQueue(name: QueueName, connection: ConnectionOptions): Queue {
  return new Queue(name, { connection });
}
