import fp from 'fastify-plugin';

import { loadConfig } from '../config.js';

export default fp(
  async (app) => {
    app.decorate('config', loadConfig());
  },
  { name: 'config' },
);
