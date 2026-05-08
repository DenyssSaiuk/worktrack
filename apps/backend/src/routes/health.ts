import type { FastifyInstance } from 'fastify';

export async function registerHealth(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/ready', async () => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      const pong = await app.redis.ping();
      return { status: 'ready', db: 'ok', redis: pong };
    } catch (err) {
      app.log.warn({ err }, 'Readiness check failed');
      throw err;
    }
  });
}
