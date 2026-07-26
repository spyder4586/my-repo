import { type Role } from './rbac';
import type { Scope } from './scope';
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
export declare function requireAuth(ctx: any, requestId?: string): Promise<{
    profile: UserProfile;
    scope: Scope;
}>;
/** Ensure the caller has one of the allowed roles, else FORBIDDEN_ROLE. */
export declare function requireRoles(allowed: Role[], ctx: unknown, requestId?: string): Promise<{
    profile: UserProfile;
    scope: Scope;
}>;
/** Validate a raw role string (from admin PATCH) before persistence. */
export declare function assertRole(value: unknown): Role;
