import fp from 'fastify-plugin';
import { ZodError } from 'zod';

import { AppError } from '../lib/errors.js';

export default fp(
  async (app) => {
    app.setErrorHandler((err, req, reply) => {
      if (err instanceof AppError) {
        req.log.warn({ err, code: err.code }, 'AppError');
        return reply.status(err.statusCode).send({
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId: req.id,
          },
        });
      }

      if (err instanceof ZodError) {
        req.log.warn({ issues: err.issues }, 'Zod validation failed');
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request payload failed validation',
            details: err.flatten(),
            requestId: req.id,
          },
        });
      }

      // Fastify validation errors carry .validation
      if ((err as { validation?: unknown }).validation) {
        req.log.warn({ err }, 'Schema validation failed');
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: err.message,
            details: (err as { validation?: unknown }).validation,
            requestId: req.id,
          },
        });
      }

      // Errors with a statusCode (http-errors / @fastify/sensible / rate-limit)
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
        const code = (err as { code?: string }).code ?? `HTTP_${statusCode}`;
        req.log.warn({ err, code, statusCode }, 'HTTP error');
        return reply.status(statusCode).send({
          error: { code, message: err.message, requestId: req.id },
        });
      }

      req.log.error({ err }, 'Unhandled error');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL',
          message: app.config.NODE_ENV === 'production' ? 'Internal error' : err.message,
          requestId: req.id,
        },
      });
    });

    app.setNotFoundHandler((req, reply) => {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `${req.method} ${req.url} not found`,
          requestId: req.id,
        },
      });
    });
  },
  { name: 'error-handler', dependencies: ['config'] },
);
