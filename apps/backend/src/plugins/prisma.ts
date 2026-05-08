import { prisma } from '@worktrack/database';
import fp from 'fastify-plugin';

export default fp(
  async (app) => {
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' },
);
