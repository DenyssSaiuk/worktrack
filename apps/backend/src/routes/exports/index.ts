import { exportRequest, ROLES } from '@worktrack/shared';
import { z } from 'zod';

import { Errors } from '../../lib/errors.js';
import { presignDownload } from '../../lib/storage.js';
import { buildConnection, createQueue, QUEUE_NAMES } from '../../workers/queues.js';

import type { FastifyInstance } from 'fastify';

const idParam = z.object({ id: z.string().min(1) });

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  const connection = buildConnection(app.config.REDIS_URL);
  const queue = createQueue(QUEUE_NAMES.EXCEL_EXPORT, connection);
  app.addHook('onClose', async () => {
    await queue.close();
  });

  app.post('/excel', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const body = exportRequest.parse(req.body);

    const job = await app.prisma.exportJob.create({
      data: {
        requestedBy: req.actor.id,
        status: 'pending',
        params: body as never,
      },
    });

    await queue.add(
      'excel-export',
      {
        jobId: job.id,
        organizationId: req.actor.organizationId,
        requestedBy: req.actor.id,
        userId: body.userId,
        from: body.from,
        to: body.to,
        includeScreenshots: body.includeScreenshots,
      },
      { attempts: 2, removeOnComplete: 50, removeOnFail: 200 },
    );

    await app.audit(req, 'export.queue', { target: job.id });
    return { jobId: job.id, status: 'pending' };
  });

  app.get('/:id', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const job = await app.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw Errors.notFound('Export job not found');

    // Refresh signed URL if expired but storage key still around.
    let downloadUrl = job.downloadUrl;
    if (job.status === 'done' && job.storageKey) {
      downloadUrl = await presignDownload(app.config, job.storageKey);
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      downloadUrl,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
    };
  });

  app.get('/', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    return app.prisma.exportJob.findMany({
      where: { requestedBy: req.actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });
}
