import fp from 'fastify-plugin';

import { createRedis } from '../lib/redis.js';

export default fp(
  async (app) => {
    const redis = createRedis(app.config);
    app.decorate('redis', redis);
    app.addHook('onClose', async () => {
      await redis.quit();
    });
  },
  { name: 'redis', dependencies: ['config'] },
);
