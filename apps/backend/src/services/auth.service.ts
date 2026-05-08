import { LIMITS } from '@worktrack/shared';
import { compare, hash } from 'bcrypt';
import { nanoid } from 'nanoid';

import type { prisma as Prisma } from '@worktrack/database';

import { Errors } from '../lib/errors.js';

import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

interface IssueTokensInput {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
}

interface IssueTokensOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const refreshKey = (jti: string): string => `rt:${jti}`;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, LIMITS.BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, digest: string): Promise<boolean> {
  return compare(plaintext, digest);
}

export async function issueTokens(
  app: FastifyInstance,
  redis: Redis,
  input: IssueTokensInput,
): Promise<IssueTokensOutput> {
  const accessToken = await app.jwt.sign(
    {
      sub: input.userId,
      email: input.email,
      role: input.role,
      organizationId: input.organizationId,
      scope: 'user',
    },
    { expiresIn: `${LIMITS.ACCESS_TOKEN_TTL_SECONDS}s` },
  );

  const jti = nanoid(24);
  const refreshToken = await app.jwt.sign(
    {
      sub: input.userId,
      jti,
      organizationId: input.organizationId,
      scope: 'user-refresh',
    },
    { expiresIn: `${LIMITS.REFRESH_TOKEN_TTL_SECONDS}s` },
  );

  await redis.set(
    refreshKey(jti),
    JSON.stringify({ userId: input.userId, organizationId: input.organizationId }),
    'EX',
    LIMITS.REFRESH_TOKEN_TTL_SECONDS,
  );

  return { accessToken, refreshToken, expiresIn: LIMITS.ACCESS_TOKEN_TTL_SECONDS };
}

export async function rotateRefreshToken(
  app: FastifyInstance,
  prisma: typeof Prisma,
  redis: Redis,
  refreshToken: string,
): Promise<
  IssueTokensOutput & { user: { id: string; email: string; role: string; organizationId: string } }
> {
  let payload: { sub: string; jti?: string; scope: string; organizationId: string };
  try {
    payload = app.jwt.verify(refreshToken) as typeof payload;
  } catch {
    throw Errors.unauthorized('Invalid refresh token');
  }

  if (payload.scope !== 'user-refresh' || !payload.jti || !payload.sub) {
    throw Errors.unauthorized('Invalid refresh token');
  }

  const stored = await redis.get(refreshKey(payload.jti));
  if (!stored) {
    throw Errors.unauthorized('Refresh token has been revoked');
  }
  // Single-use rotation: drop the old jti regardless of what happens next.
  await redis.del(refreshKey(payload.jti));

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'active') throw Errors.unauthorized('User not active');

  const tokens = await issueTokens(app, redis, {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizationId: user.organizationId,
  });

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

export async function revokeRefreshToken(
  app: FastifyInstance,
  redis: Redis,
  refreshToken: string,
): Promise<void> {
  try {
    const payload = app.jwt.verify(refreshToken) as { jti?: string; scope?: string };
    if (payload.scope === 'user-refresh' && payload.jti) {
      await redis.del(refreshKey(payload.jti));
    }
  } catch {
    // ignore — already invalid
  }
}

export async function loginWithPassword(
  app: FastifyInstance,
  prisma: typeof Prisma,
  redis: Redis,
  email: string,
  password: string,
): Promise<
  IssueTokensOutput & {
    user: { id: string; email: string; fullName: string; role: string; organizationId: string };
  }
> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== 'active') {
    throw Errors.unauthorized('Invalid email or password');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw Errors.unauthorized('Invalid email or password');

  const tokens = await issueTokens(app, redis, {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizationId: user.organizationId,
  });

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}
