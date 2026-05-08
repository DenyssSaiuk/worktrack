/**
 * Worker process entrypoint. Run separately from the API:
 *   tsx src/workers/start.ts
 * In production: `node dist/workers/start.js`.
 */
import { pino } from 'pino';

import { loadConfig } from '../config.js';
import { startAggregateDailyWorker } from './aggregate-daily.js';
import { startAnalyzeScreenshotWorker } from './analyze-screenshot.js';
import { startExcelExportWorker } from './excel-export.js';
import { buildConnection } from './queues.js';
import { startSchedulers } from './scheduler.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = pino({ level: cfg.LOG_LEVEL, name: 'workers' });
  const connection = buildConnection(cfg.REDIS_URL);

  const aggregateWorker = startAggregateDailyWorker(connection, log);
  aggregateWorker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'Job failed'));

  const excelWorker = startExcelExportWorker(connection, log);
  excelWorker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'Excel export failed'));

  const aiWorker = startAnalyzeScreenshotWorker(connection, log);
  aiWorker.on('failed', (job, err) =>
    log.error({ jobId: job?.id, err }, 'AI screenshot analysis failed'),
  );

  const schedulers = await startSchedulers(cfg.REDIS_URL, log);

  log.info('Workers running');

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Shutting down workers');
    await aggregateWorker.close();
    await excelWorker.close();
    await aiWorker.close();
    await schedulers.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
