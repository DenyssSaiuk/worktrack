import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import auditPlugin from './plugins/audit.js';
import authPlugin from './plugins/auth.js';
import configPlugin from './plugins/config.js';
import errorHandler from './plugins/error-handler.js';
import jwtPlugin from './plugins/jwt.js';
import prismaPlugin from './plugins/prisma.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import redisPlugin from './plugins/redis.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerAuthRoutes } from './routes/auth/index.js';
import { registerHealth } from './routes/health.js';
import { registerIngestRoutes } from './routes/ingest/index.js';
import { registerUserRoutes } from './routes/users/index.js';

import type { FastifyInstance, FastifyServerOptions } from 'fastify';

export interface BuildAppOptions extends FastifyServerOptions {
  disableAudit?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const isDev = (process.env.NODE_ENV ?? 'development') === 'development';
  const logger =
    opts.logger !== undefined
      ? opts.logger
      : isDev
        ? {
            level: process.env.LOG_LEVEL ?? 'info',
            transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          }
        : { level: process.env.LOG_LEVEL ?? 'info' };

  const app = Fastify({
    logger,
    genReqId: () => randomUUID(),
    ...opts,
  });

  await app.register(configPlugin);
  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: app.config.DASHBOARD_ORIGIN,
    credentials: true,
  });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jwtPlugin);
  await app.register(authPlugin);
  await app.register(errorHandler);
  if (!opts.disableAudit) await app.register(auditPlugin);

  await registerHealth(app);
  await app.register(
    async (instance) => {
      await registerAuthRoutes(instance);
    },
    { prefix: '/api/v1/auth' },
  );
  await app.register(
    async (instance) => {
      await registerUserRoutes(instance);
    },
    { prefix: '/api/v1/users' },
  );
  await app.register(
    async (instance) => {
      await registerAdminRoutes(instance);
    },
    { prefix: '/api/v1/admin' },
  );
  await app.register(
    async (instance) => {
      await registerIngestRoutes(instance);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
