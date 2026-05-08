import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  BACKEND_HOST: z.string().default('0.0.0.0'),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
  DASHBOARD_ORIGIN: z.string().url().default('http://localhost:3000'),
  JWT_PRIVATE_KEY_PATH: z.string().default('../../secrets/jwt-private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('../../secrets/jwt-public.pem'),
  MASTER_KEK_BASE64: z.string().optional(),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('worktrack'),
  S3_SECRET_KEY: z.string().default('worktrack-dev-secret'),
  S3_BUCKET: z.string().default('worktrack'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-4-6'),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  jwtPrivateKey: string;
  jwtPublicKey: string;
  masterKek: Buffer | null;
};

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;

  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  const cfg = parsed.data;
  const cwd = process.cwd();

  const jwtPrivateKey = readKey(resolve(cwd, cfg.JWT_PRIVATE_KEY_PATH), 'JWT_PRIVATE_KEY_PATH');
  const jwtPublicKey = readKey(resolve(cwd, cfg.JWT_PUBLIC_KEY_PATH), 'JWT_PUBLIC_KEY_PATH');

  const masterKek = cfg.MASTER_KEK_BASE64 ? Buffer.from(cfg.MASTER_KEK_BASE64, 'base64') : null;
  if (masterKek && masterKek.length !== 32) {
    throw new Error('MASTER_KEK_BASE64 must decode to exactly 32 bytes');
  }

  cached = { ...cfg, jwtPrivateKey, jwtPublicKey, masterKek };
  return cached;
}

function readKey(path: string, label: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `Cannot read ${label} from ${path}: ${(err as Error).message}. ` +
        `Run \`pnpm --filter @worktrack/backend keys:generate\` to create them.`,
    );
  }
}

export function resetConfigForTests(): void {
  cached = undefined;
}
