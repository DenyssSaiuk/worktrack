import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';

import auditPlugin from './plugins/audit.js';
import authPlugin from './plugins/auth.js';
import configPlugin from './plugins/config.js';
import errorHandler from './plugins/error-handler.js';
import jwtPlugin from './plugins/jwt.js';
import prismaPlugin from './plugins/prisma.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import redisPlugin from './plugins/redis.js';
import { registerActivityRoutes } from './routes/activity/index.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerAuthRoutes } from './routes/auth/index.js';
import { registerExportRoutes } from './routes/exports/index.js';
import { registerHealth } from './routes/health.js';
import { registerIngestRoutes } from './routes/ingest/index.js';
import { registerMeRoutes } from './routes/me/index.js';
import { registerRulesRoutes } from './routes/rules/index.js';
import { registerScreenshotRoutes } from './routes/screenshots/index.js';
import { registerSettingsRoutes } from './routes/settings/index.js';
import { registerUserRoutes } from './routes/users/index.js';
import { registerWsRoutes } from './routes/ws.js';

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
  await app.register(websocket);
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
  await app.register(
    async (instance) => {
      await registerMeRoutes(instance);
    },
    { prefix: '/api/v1/me' },
  );
  await app.register(
    async (instance) => {
      await registerActivityRoutes(instance);
    },
    { prefix: '/api/v1/activity' },
  );
  await app.register(
    async (instance) => {
      await registerRulesRoutes(instance);
    },
    { prefix: '/api/v1/rules' },
  );
  await app.register(
    async (instance) => {
      await registerSettingsRoutes(instance);
    },
    { prefix: '/api/v1/organizations' },
  );
  await app.register(
    async (instance) => {
      await registerExportRoutes(instance);
    },
    { prefix: '/api/v1/exports' },
  );
  await app.register(
    async (instance) => {
      await registerScreenshotRoutes(instance);
    },
    { prefix: '/api/v1/screenshots' },
  );
  await app.register(
    async (instance) => {
      await registerWsRoutes(instance);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
