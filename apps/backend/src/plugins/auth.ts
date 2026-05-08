import fp from 'fastify-plugin';

import { Errors } from '../lib/errors.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

interface DecodedToken {
  sub: string;
  email?: string;
  role?: string;
  organizationId: string;
  scope: 'user' | 'user-refresh' | 'agent';
  jti?: string;
  deviceId?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireUser: (
      ...roles: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAgent: () => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(
  async (app) => {
    const authenticate = async (req: FastifyRequest): Promise<DecodedToken> => {
      try {
        const decoded = await req.jwtVerify<DecodedToken>();
        if (decoded.scope !== 'user' && decoded.scope !== 'agent') {
          throw Errors.unauthorized('Token scope is invalid');
        }
        if (decoded.scope === 'user') {
          if (!decoded.email || !decoded.role) throw Errors.unauthorized('Malformed user token');
          req.actor = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            organizationId: decoded.organizationId,
            scope: 'user',
          };
        } else {
          if (!decoded.deviceId) throw Errors.unauthorized('Malformed agent token');
          req.actor = {
            id: decoded.sub,
            role: 'agent',
            organizationId: decoded.organizationId,
            scope: 'agent',
            deviceId: decoded.deviceId,
          };
        }
        return decoded;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Required role')) throw err;
        throw Errors.unauthorized((err as Error).message ?? 'Invalid token');
      }
    };

    app.decorate('requireUser', (...roles: string[]) => async (req: FastifyRequest) => {
      const token = await authenticate(req);
      if (token.scope !== 'user') throw Errors.forbidden('User token required');
      if (roles.length > 0 && !roles.includes(token.role ?? '')) {
        throw Errors.forbidden(`Required role: ${roles.join(' or ')}`);
      }
    });

    app.decorate('requireAgent', () => async (req: FastifyRequest) => {
      const token = await authenticate(req);
      if (token.scope !== 'agent') throw Errors.forbidden('Agent token required');
    });
  },
  { name: 'auth', dependencies: ['jwt'] },
);
