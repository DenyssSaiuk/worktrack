import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';

export default fp(
  async (app) => {
    await app.register(jwt, {
      secret: {
        private: app.config.jwtPrivateKey,
        public: app.config.jwtPublicKey,
      },
      sign: { algorithm: 'RS256' },
      verify: { algorithms: ['RS256'] },
    });
  },
  { name: 'jwt', dependencies: ['config'] },
);
