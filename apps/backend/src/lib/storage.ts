import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '../config.js';

let cached: S3Client | null = null;

export function s3Client(cfg: AppConfig): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: cfg.S3_REGION,
    endpoint: cfg.S3_ENDPOINT,
    forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY,
      secretAccessKey: cfg.S3_SECRET_KEY,
    },
  });
  return cached;
}

export async function uploadObject(
  cfg: AppConfig,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = s3Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function presignDownload(
  cfg: AppConfig,
  key: string,
  expiresInSeconds = 24 * 60 * 60,
): Promise<string> {
  const client = s3Client(cfg);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}
