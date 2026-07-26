/**
 * Auth middleware primitives.
 * Reference: BACKEND_ARCHITECTURE.md, SECURITY.md, CATALYST_INTEGRATION.md #2.
 *
 * NOTE: Full implementation lands in sub-phase 1B.
 * Catalyst SDK user resolution + Data Store UserProfile lookup lives here then.
 * This stub exposes the expected API shape so handlers can be written against it.
 */
import { ApiError } from './errors';
import { isRole, type Role } from './rbac';
import type { Scope } from './scope';
import { logger } from './logger';

/** Resolved user profile from Data Store `App_UserProfile`. */
export interface UserProfile {
  userProfileId: number;
  catalystUserId: string;
  employeeId?: number | null;
  role: Role;
  districtId?: number | null;
  unitId?: number | null;
  active: boolean;
}

/**
 * Require authentication.
 * Resolves Catalyst SDK current user id and loads UserProfile from Data Store.
 */
import { catalyst } from './datastore';
import { AuthRepository } from './repositories/AuthRepository';

export async function requireAuth(
  ctx: any,
  requestId?: string,
): Promise<{ profile: UserProfile; scope: Scope }> {
  const app = catalyst(ctx) as any;
  
  let catalystUserId: string;
  try {
    // Strictly validate Catalyst Authentication
    const userManagement = app.userManagement();
    const user = await userManagement.getCurrentUser();
    
    if (!user || !user.user_id) {
      throw new Error('User not found in Catalyst Auth');
    }
    catalystUserId = user.user_id.toString();
  } catch (err) {
    logger.error('requireAuth.failed', { requestId, error: String(err) });
    throw new ApiError('UNAUTHORIZED', 'Missing or invalid Catalyst Auth token.', requestId);
  }

  // Fetch from Data Store App_UserProfile table via AuthRepository
  const repo = new AuthRepository(app.zcql());
  const row = await repo.getActiveProfileByCatalystId(catalystUserId);

  if (!row) {
    throw new ApiError('PROFILE_REQUIRED', `No active profile for user ${catalystUserId}`, requestId);
  }

  const profile: UserProfile = {
    userProfileId: row.UserProfileID,
    catalystUserId: row.CatalystUserId,
    employeeId: row.EmployeeID,
    role: row.Role as Role,
    districtId: row.DistrictID,
    unitId: row.UnitID,
    active: row.Active,
  };

  const scope: Scope = {
    role: profile.role,
    districtId: profile.districtId ?? undefined,
    unitId: profile.unitId ?? undefined,
    employeeId: profile.employeeId ?? undefined,
    active: profile.active,
  };

  return { profile, scope };
}

/** Ensure the caller has one of the allowed roles, else FORBIDDEN_ROLE. */
export async function requireRoles(
  allowed: Role[],
  ctx: unknown,
  requestId?: string,
): Promise<{ profile: UserProfile; scope: Scope }> {
  const { profile, scope } = await requireAuth(ctx, requestId);
  if (!allowed.includes(profile.role)) {
    throw new ApiError(
      'FORBIDDEN_ROLE',
      `Role ${profile.role} cannot access this resource.`,
      requestId,
    );
  }
  return { profile, scope };
}

/** Validate a raw role string (from admin PATCH) before persistence. */
export function assertRole(value: unknown): Role {
  if (!isRole(value)) {
    throw new ApiError('VALIDATION_ERROR', `Unknown role: ${String(value)}`);
  }
  return value;
}
