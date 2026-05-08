import { Redis } from 'ioredis';

import type { AppConfig } from '../config.js';

export function createRedis(cfg: AppConfig): Redis {
  return new Redis(cfg.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
