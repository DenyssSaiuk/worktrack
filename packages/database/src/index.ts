import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __worktrackPrisma: PrismaClient | undefined;
}

const createClient = (): PrismaClient =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  });

export const prisma: PrismaClient = globalThis.__worktrackPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__worktrackPrisma = prisma;
}

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';
export type {
  ActivityEvent,
  AuditLog,
  ConsentRecord,
  DailySummary,
  Device,
  EnrollToken,
  ExportJob,
  Organization,
  ProductivityRule,
  Screenshot,
  User,
  WorkSession,
} from '@prisma/client';
