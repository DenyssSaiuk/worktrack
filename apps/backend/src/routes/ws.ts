/**
 * WebSocket endpoint for live dashboard updates. Authenticated by passing
 * the user JWT as a query parameter (?token=...) since browser WebSocket
 * APIs cannot send custom headers. We accept that trade-off because the
 * connection is short-lived, scoped to the organization, and the token is
 * already in localStorage on the dashboard. Requests from another origin
 * fail CORS.
 */
import { Errors } from '../lib/errors.js';

import type { FastifyInstance } from 'fastify';

interface ClientCtx {
  organizationId: string;
  userId: string;
  role: string;
}

const sockets = new Map<string, Set<{ ctx: ClientCtx; send: (s: string) => void }>>();

export async function registerWsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, req) => {
    void (async () => {
      const token = (req.query as { token?: string }).token;
      if (!token) {
        socket.send(JSON.stringify({ kind: 'error', message: 'token required' }));
        socket.close();
        return;
      }
      let ctx: ClientCtx;
      try {
        const decoded = app.jwt.verify(token) as {
          sub: string;
          role?: string;
          scope: string;
          organizationId: string;
        };
        if (decoded.scope !== 'user' || !decoded.role) {
          throw new Error('invalid scope');
        }
        ctx = {
          organizationId: decoded.organizationId,
          userId: decoded.sub,
          role: decoded.role,
        };
      } catch {
        socket.send(JSON.stringify({ kind: 'error', message: 'invalid token' }));
        socket.close();
        return;
      }

      const orgSet = sockets.get(ctx.organizationId) ?? new Set();
      const handle = { ctx, send: (s: string) => socket.send(s) };
      orgSet.add(handle);
      sockets.set(ctx.organizationId, orgSet);

      socket.send(JSON.stringify({ kind: 'hello', userId: ctx.userId }));

      socket.on('close', () => {
        orgSet.delete(handle);
        if (orgSet.size === 0) sockets.delete(ctx.organizationId);
      });
    })().catch((err) => {
      app.log.warn({ err }, 'ws handshake failed');
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    });
  });
}

export function broadcast(organizationId: string, message: unknown): void {
  const set = sockets.get(organizationId);
  if (!set) return;
  const payload = JSON.stringify(message);
  for (const client of set) {
    try {
      client.send(payload);
    } catch {
      /* connection died, will be cleaned up on close */
    }
  }
}

export { Errors };
