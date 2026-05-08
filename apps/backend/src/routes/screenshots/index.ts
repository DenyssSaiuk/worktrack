import '@fastify/multipart';

import { ROLES, SCREENSHOT_TRIGGER_VALUES } from '@worktrack/shared';
import { z } from 'zod';

import { deriveOrgKey, encrypt } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { presignDownload, uploadObject } from '../../lib/storage.js';
import { buildConnection, createQueue, QUEUE_NAMES } from '../../workers/queues.js';

import type { FastifyInstance } from 'fastify';

const idParam = z.object({ id: z.string().min(1) });
const reviewBody = z.object({
  decision: z.enum(['approve', 'flag', 'dismiss']),
  notes: z.string().max(2_000).optional(),
});

export async function registerScreenshotRoutes(app: FastifyInstance): Promise<void> {
  const connection = buildConnection(app.config.REDIS_URL);
  const aiQueue = createQueue(QUEUE_NAMES.ANALYZE_SCREENSHOT, connection);
  app.addHook('onClose', async () => {
    await aiQueue.close();
  });

  // Agent-only: multipart upload of the captured screenshot. The agent
  // captures the bytes locally; the server encrypts with the org-derived
  // key, stores in S3, and (if enabled) queues AI analysis.
  app.post(
    '/screenshot',
    {
      preHandler: app.requireAgent(),
      bodyLimit: 8 * 1024 * 1024,
    },
    async (req, reply) => {
      if (!req.actor || req.actor.scope !== 'agent') throw Errors.forbidden();
      if (!req.actor.deviceId) throw Errors.forbidden('Agent token missing deviceId');
      if (!app.config.masterKek) {
        throw Errors.internal('Server has no master KEK configured; cannot encrypt screenshots');
      }

      const part = await req.file();
      if (!part) throw Errors.badRequest('multipart file required');
      const fields = part.fields as Record<string, { value?: string } | undefined>;
      const meta = z
        .object({
          sessionId: z.string().min(1),
          trigger: z.enum(SCREENSHOT_TRIGGER_VALUES as [string, ...string[]]),
          width: z.coerce.number().int().positive(),
          height: z.coerce.number().int().positive(),
          takenAt: z.string().datetime({ offset: true }),
        })
        .parse({
          sessionId: fields['sessionId']?.value,
          trigger: fields['trigger']?.value,
          width: fields['width']?.value,
          height: fields['height']?.value,
          takenAt: fields['takenAt']?.value,
        });

      const session = await app.prisma.workSession.findFirst({
        where: { id: meta.sessionId, userId: req.actor.id, deviceId: req.actor.deviceId },
      });
      if (!session) throw Errors.notFound('Session not found');

      const buf = await part.toBuffer();
      const { key, keyId } = deriveOrgKey(app.config.masterKek, req.actor.organizationId);
      const enc = encrypt(buf, key, keyId);

      const storageKey = `screenshots/${req.actor.organizationId}/${meta.sessionId}/${Date.now()}.bin`;
      const cipherBlob = Buffer.concat([
        Buffer.from(JSON.stringify({ ivBase64: enc.ivBase64, tagBase64: enc.tagBase64, keyId })),
        Buffer.from('\n'),
        Buffer.from(enc.ciphertextBase64, 'base64'),
      ]);
      await uploadObject(app.config, storageKey, cipherBlob, 'application/octet-stream');

      const shot = await app.prisma.screenshot.create({
        data: {
          sessionId: meta.sessionId,
          takenAt: new Date(meta.takenAt),
          trigger: meta.trigger,
          storageKey,
          width: meta.width,
          height: meta.height,
          encryption: { algo: enc.algo, ivBase64: enc.ivBase64, keyId } as never,
        },
      });

      // If AI analysis is enabled per-org, queue a job; otherwise the
      // screenshot waits in the manager review queue.
      const org = await app.prisma.organization.findUnique({
        where: { id: req.actor.organizationId },
      });
      if (org && (org.settings as { aiAnalysisEnabled?: boolean }).aiAnalysisEnabled) {
        await aiQueue.add(
          'analyze',
          { screenshotId: shot.id, organizationId: req.actor.organizationId, storageKey },
          { attempts: 2, removeOnComplete: 200, removeOnFail: 500 },
        );
      }

      reply.header('x-audit-skip', '1');
      return { id: shot.id };
    },
  );

  // Manager + admin: review queue.
  app.get('/', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const reviewed = (req.query as { reviewed?: string }).reviewed === 'true';
    const shots = await app.prisma.screenshot.findMany({
      where: {
        reviewed,
        session: { user: { organizationId: req.actor.organizationId } },
      },
      orderBy: { takenAt: 'desc' },
      take: 100,
      include: { session: { include: { user: { select: { id: true, fullName: true } } } } },
    });
    return Promise.all(
      shots.map(async (s) => ({
        id: s.id,
        takenAt: s.takenAt,
        trigger: s.trigger,
        aiSummary: s.aiSummary,
        aiCategory: s.aiCategory,
        reviewed: s.reviewed,
        user: s.session.user,
        downloadUrl: await presignDownload(app.config, s.storageKey, 5 * 60).catch(() => null),
      })),
    );
  });

  app.post(
    '/:id/review',
    { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) },
    async (req) => {
      if (!req.actor) throw Errors.unauthorized();
      const { id } = idParam.parse(req.params);
      const body = reviewBody.parse(req.body);
      const shot = await app.prisma.screenshot.findFirst({
        where: { id, session: { user: { organizationId: req.actor.organizationId } } },
      });
      if (!shot) throw Errors.notFound();
      const updated = await app.prisma.screenshot.update({
        where: { id },
        data: { reviewed: true, reviewedBy: req.actor.id, reviewedAt: new Date() },
      });
      await app.audit(req, `screenshot.review.${body.decision}`, {
        target: id,
        metadata: body.notes ? { notes: body.notes } : null,
      });
      return updated;
    },
  );
}
