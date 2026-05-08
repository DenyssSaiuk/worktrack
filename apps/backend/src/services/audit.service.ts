import type { prisma as Prisma } from '@worktrack/database';

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(prisma: typeof Prisma, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      metadata: (entry.metadata ?? undefined) as never,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
