import { Anthropic } from '@anthropic-ai/sdk';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@worktrack/database';
import { Worker } from 'bullmq';

import { loadConfig } from '../config.js';
import { QUEUE_NAMES } from './queues.js';
import { decrypt, deriveOrgKey } from '../lib/crypto.js';
import { s3Client } from '../lib/storage.js';
import { broadcast } from '../routes/ws.js';

import type { ConnectionOptions } from 'bullmq';
import type { Logger } from 'pino';

interface AnalyzeJobData {
  screenshotId: string;
  organizationId: string;
  storageKey: string;
}

const PROMPT = `You are reviewing a workplace screenshot for a productivity-tracking system.

Reply with strict JSON only, no prose, matching this schema:
{
  "category": "productive" | "neutral" | "distracting" | "unsure",
  "detected_app": string,
  "summary": string (max 200 chars, neutral, factual),
  "work_related": "yes" | "no" | "unsure"
}

Avoid identifying specific people. Avoid commentary. Be conservative — when
in doubt prefer "unsure".`;

export function startAnalyzeScreenshotWorker(
  connection: ConnectionOptions,
  log: Logger,
): Worker<AnalyzeJobData> {
  const cfg = loadConfig();
  const aiKey = cfg.ANTHROPIC_API_KEY;
  if (!aiKey) log.warn('ANTHROPIC_API_KEY not set — analyze-screenshot will skip jobs');

  const anthropic = aiKey ? new Anthropic({ apiKey: aiKey }) : null;

  return new Worker<AnalyzeJobData>(
    QUEUE_NAMES.ANALYZE_SCREENSHOT,
    async (job) => {
      const { screenshotId, organizationId, storageKey } = job.data;
      if (!anthropic) {
        log.warn({ screenshotId }, 'AI disabled — skip');
        return { skipped: true };
      }
      if (!cfg.masterKek) {
        log.warn({ screenshotId }, 'no master KEK — cannot decrypt');
        return { skipped: true };
      }

      // Fetch + decrypt the screenshot.
      const obj = await s3Client(cfg).send(
        new GetObjectCommand({ Bucket: cfg.S3_BUCKET, Key: storageKey }),
      );
      const bodyBytes = await obj.Body!.transformToByteArray();
      const sep = bodyBytes.indexOf(0x0a); // newline separates header JSON from ciphertext
      if (sep < 0) throw new Error('malformed screenshot blob');
      const headerJson = JSON.parse(Buffer.from(bodyBytes.subarray(0, sep)).toString('utf8')) as {
        ivBase64: string;
        tagBase64: string;
        keyId: string;
      };
      const ciphertextBase64 = Buffer.from(bodyBytes.subarray(sep + 1)).toString('utf8');
      const { key } = deriveOrgKey(cfg.masterKek, organizationId, headerJson.keyId);
      const png = decrypt(
        {
          algo: 'aes-256-gcm',
          ivBase64: headerJson.ivBase64,
          tagBase64: headerJson.tagBase64,
          ciphertextBase64,
          keyId: headerJson.keyId,
        },
        key,
      );

      const imageBase64 = png.toString('base64');

      const response = await anthropic.messages.create({
        model: cfg.AI_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      });

      const text = response.content
        .filter((c): c is Extract<typeof c, { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join('');

      let parsed: { category?: string; summary?: string };
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { summary: text.slice(0, 200) };
      }

      await prisma.screenshot.update({
        where: { id: screenshotId },
        data: {
          aiSummary: parsed.summary ?? null,
          aiCategory: parsed.category ?? null,
        },
      });

      broadcast(organizationId, {
        kind: 'screenshot.analyzed',
        screenshotId,
        category: parsed.category,
      });

      return { ok: true };
    },
    { connection, concurrency: 1 },
  );
}

export type { AnalyzeJobData };
