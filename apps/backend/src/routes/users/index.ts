import { createUserRequest, paginationQuery, updateUserRequest, ROLES } from '@worktrack/shared';
import { z } from 'zod';

import { Errors } from '../../lib/errors.js';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  suspendUser,
  updateUser,
} from '../../services/users.service.js';

import type { FastifyInstance } from 'fastify';

const idParam = z.object({ id: z.string().min(1) });

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { page, pageSize } = paginationQuery.parse(req.query);
    const { items, total } = await listUsers(app.prisma, req.actor.organizationId, {
      page,
      pageSize,
    });
    return {
      items: items.map(toPublic),
      total,
      page,
      pageSize,
    };
  });

  app.get('/:id', { preHandler: app.requireUser(ROLES.ADMIN, ROLES.MANAGER) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const user = await getUser(app.prisma, req.actor.organizationId, id);
    return toPublic(user);
  });

  app.post('/', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const body = createUserRequest.parse(req.body);
    const user = await createUser(app.prisma, req.actor.organizationId, body);
    await app.audit(req, 'user.create', { target: user.id, metadata: { email: user.email } });
    return toPublic(user);
  });

  app.patch('/:id', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const body = updateUserRequest.parse(req.body);
    const user = await updateUser(app.prisma, req.actor.organizationId, id, body);
    await app.audit(req, 'user.update', { target: id });
    return toPublic(user);
  });

  app.post('/:id/suspend', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    const user = await suspendUser(app.prisma, req.actor.organizationId, id);
    await app.audit(req, 'user.suspend', { target: id });
    return toPublic(user);
  });

  app.delete('/:id', { preHandler: app.requireUser(ROLES.ADMIN) }, async (req) => {
    if (!req.actor) throw Errors.unauthorized();
    const { id } = idParam.parse(req.params);
    await deleteUser(app.prisma, req.actor.organizationId, id);
    await app.audit(req, 'user.delete', { target: id });
    return { ok: true };
  });
}

interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  managerId: string | null;
  status: string;
  workSchedule: unknown;
  createdAt: Date;
}

function toPublic(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  managerId: string | null;
  status: string;
  workSchedule: unknown;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    managerId: user.managerId,
    status: user.status,
    workSchedule: user.workSchedule,
    createdAt: user.createdAt,
  };
}
