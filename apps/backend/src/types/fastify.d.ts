import type { prisma } from '@worktrack/database';

import type { AppConfig } from '../config.js';
import type { Redis } from 'ioredis';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email?: string;
      role?: string;
      organizationId: string;
      scope: 'user' | 'user-refresh' | 'agent';
      jti?: string;
      deviceId?: string;
    };
    user: {
      sub: string;
      email?: string;
      role?: string;
      organizationId: string;
      scope: 'user' | 'user-refresh' | 'agent';
      jti?: string;
      deviceId?: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    prisma: typeof prisma;
    redis: Redis;
  }

  // Our app-specific decoration. We don't override req.user — that belongs to
  // @fastify/jwt — instead we set req.actor in the auth plugin after verifying.
  interface FastifyRequest {
    actor?: {
      id: string;
      email?: string;
      role: string;
      organizationId: string;
      scope: 'user' | 'agent';
      deviceId?: string;
    };
  }
}

export {};
