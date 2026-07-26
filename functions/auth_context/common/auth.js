"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRoles = requireRoles;
exports.assertRole = assertRole;
/**
 * Auth middleware primitives.
 * Reference: BACKEND_ARCHITECTURE.md, SECURITY.md, CATALYST_INTEGRATION.md #2.
 *
 * NOTE: Full implementation lands in sub-phase 1B.
 * Catalyst SDK user resolution + Data Store UserProfile lookup lives here then.
 * This stub exposes the expected API shape so handlers can be written against it.
 */
const errors_1 = require("./errors");
const rbac_1 = require("./rbac");
const logger_1 = require("./logger");
/**
 * Require authentication.
 * Resolves Catalyst SDK current user id and loads UserProfile from Data Store.
 */
const datastore_1 = require("./datastore");
const AuthRepository_1 = require("./repositories/AuthRepository");
async function requireAuth(ctx, requestId) {
    const app = (0, datastore_1.catalyst)(ctx);
    let catalystUserId;
    try {
        // Strictly validate Catalyst Authentication
        const userManagement = app.userManagement();
        const user = await userManagement.getCurrentUser();
        if (!user || !user.user_id) {
            throw new Error('User not found in Catalyst Auth');
        }
        catalystUserId = user.user_id.toString();
    }
    catch (err) {
        logger_1.logger.error('requireAuth.failed', { requestId, error: String(err) });
        throw new errors_1.ApiError('UNAUTHORIZED', 'Missing or invalid Catalyst Auth token.', requestId);
    }
    // Fetch from Data Store App_UserProfile table via AuthRepository
    const repo = new AuthRepository_1.AuthRepository(app.zcql());
    const row = await repo.getActiveProfileByCatalystId(catalystUserId);
    if (!row) {
        throw new errors_1.ApiError('PROFILE_REQUIRED', `No active profile for user ${catalystUserId}`, requestId);
    }
    const profile = {
        userProfileId: row.UserProfileID,
        catalystUserId: row.CatalystUserId,
        employeeId: row.EmployeeID,
        role: row.Role,
        districtId: row.DistrictID,
        unitId: row.UnitID,
        active: row.Active,
    };
    const scope = {
        role: profile.role,
        districtId: profile.districtId ?? undefined,
        unitId: profile.unitId ?? undefined,
        employeeId: profile.employeeId ?? undefined,
        active: profile.active,
    };
    return { profile, scope };
}
/** Ensure the caller has one of the allowed roles, else FORBIDDEN_ROLE. */
async function requireRoles(allowed, ctx, requestId) {
    const { profile, scope } = await requireAuth(ctx, requestId);
    if (!allowed.includes(profile.role)) {
        throw new errors_1.ApiError('FORBIDDEN_ROLE', `Role ${profile.role} cannot access this resource.`, requestId);
    }
    return { profile, scope };
}
/** Validate a raw role string (from admin PATCH) before persistence. */
function assertRole(value) {
    if (!(0, rbac_1.isRole)(value)) {
        throw new errors_1.ApiError('VALIDATION_ERROR', `Unknown role: ${String(value)}`);
    }
    return value;
}
//# sourceMappingURL=auth.js.map