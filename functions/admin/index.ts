/**
 * Admin Function — users, jobs, import, audit.
 * Reference: IMPLEMENTATION2.md 5C, API_REFERENCE.md "Admin".
 * Status: scaffold (5C implements; admin APIs partial from 1B).
 */
import { logger, newRequestId } from './common/logger';
import { ok, toResponse } from './common/errors';
import { requireRoles } from './common/auth';

export default async function admin(ctx: unknown) {
  const requestId = newRequestId();
  try {
    await requireRoles(['SUPER_ADMIN'], ctx, requestId);
    logger.info('admin.stub', { requestId, route: '/admin' });
    return ok({ message: 'admin endpoint scaffolded — implemented in sub-phase 5C' });
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = admin;
