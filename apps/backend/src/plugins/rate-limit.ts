import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

export default fp(
  async (app) => {
    await app.register(rateLimit, {
      global: false,
      redis: app.redis,
      timeWindow: '1 minute',
      max: 300,
      keyGenerator: (req) => `${req.ip}:${req.routeOptions.url ?? req.url}`,
      errorResponseBuilder: (_req, ctx) => ({
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests — retry in ${ctx.after}`,
        },
      }),
    });
  },
  { name: 'rate-limit', dependencies: ['redis'] },
);
