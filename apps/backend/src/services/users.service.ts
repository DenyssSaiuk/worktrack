import type { prisma as Prisma, User } from '@worktrack/database';
import type { CreateUserRequest, UpdateUserRequest } from '@worktrack/shared';

import { hashPassword } from './auth.service.js';
import { Errors } from '../lib/errors.js';

export async function listUsers(
  prisma: typeof Prisma,
  organizationId: string,
  opts: { page: number; pageSize: number },
): Promise<{ items: User[]; total: number }> {
  const where = { organizationId };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

export async function getUser(
  prisma: typeof Prisma,
  organizationId: string,
  id: string,
): Promise<User> {
  const user = await prisma.user.findFirst({ where: { id, organizationId } });
  if (!user) throw Errors.notFound('User not found');
  return user;
}

export async function createUser(
  prisma: typeof Prisma,
  organizationId: string,
  input: CreateUserRequest,
): Promise<User> {
  const email = input.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw Errors.conflict('A user with that email already exists');

  if (input.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: input.managerId, organizationId },
    });
    if (!manager)
      throw Errors.badRequest('managerId does not reference a user in this organization');
  }

  return prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      role: input.role,
      managerId: input.managerId ?? null,
      workSchedule: (input.workSchedule ?? undefined) as never,
    },
  });
}

export async function updateUser(
  prisma: typeof Prisma,
  organizationId: string,
  id: string,
  input: UpdateUserRequest,
): Promise<User> {
  await getUser(prisma, organizationId, id);

  if (input.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: input.managerId, organizationId },
    });
    if (!manager)
      throw Errors.badRequest('managerId does not reference a user in this organization');
  }

  const data: Record<string, unknown> = {};
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.role !== undefined) data.role = input.role;
  if (input.managerId !== undefined) data.managerId = input.managerId;
  if (input.workSchedule !== undefined) data.workSchedule = input.workSchedule;
  if (input.password !== undefined) data.passwordHash = await hashPassword(input.password);

  return prisma.user.update({ where: { id }, data });
}

export async function suspendUser(
  prisma: typeof Prisma,
  organizationId: string,
  id: string,
): Promise<User> {
  await getUser(prisma, organizationId, id);
  return prisma.user.update({ where: { id }, data: { status: 'suspended' } });
}

export async function deleteUser(
  prisma: typeof Prisma,
  organizationId: string,
  id: string,
): Promise<void> {
  await getUser(prisma, organizationId, id);
  // Soft delete: keeps audit-trail integrity. Hard erasure handled by GDPR
  // erasure endpoint, which removes activity events and PII.
  await prisma.user.update({ where: { id }, data: { status: 'deleted' } });
}
