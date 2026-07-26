"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = me;
/**
 * Auth context Function — GET /api/v1/me
 * Authenticated. Returns caller role, districtId, unitId, permissions.
 * Reference: IMPLEMENTATION2.md 1B, API_REFERENCE.md "GET /api/v1/me".
 *
 * STUB until 1B: returns PROFILE_REQUIRED (auth not wired yet).
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const rbac_1 = require("./common/rbac");
const config_1 = require("./common/config");
async function me(ctx, basicIO) {
    const requestId = (0, logger_1.newRequestId)();
    let result;
    try {
        const { profile, scope } = await (0, auth_1.requireAuth)(ctx, requestId);
        const cfg = (0, config_1.config)();
        logger_1.logger.info('me.fetch', {
            requestId,
            route: '/me',
            userId: profile.catalystUserId,
            role: profile.role,
        });
        result = (0, errors_1.ok)({
            userProfileId: profile.userProfileId,
            role: profile.role,
            districtId: profile.districtId ?? null,
            unitId: profile.unitId ?? null,
            employeeId: profile.employeeId ?? null,
            permissions: {
                canSeePii: (0, rbac_1.canSeePii)(profile.role, cfg.piiRoles),
                canExport: (0, rbac_1.canExport)(profile.role, cfg.exportRoles),
                isAdmin: (0, rbac_1.isAdmin)(profile.role),
                canReadAudit: (0, rbac_1.canReadAudit)(profile.role),
                isStateScope: (0, rbac_1.isStateScope)(profile.role),
            },
            home: (0, rbac_1.defaultHome)(profile.role),
            scope,
        });
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        result = { status, body };
    }
    if (basicIO && typeof basicIO.write === 'function') {
        basicIO.write(JSON.stringify(result));
        basicIO.close();
    }
    return result;
}
module.exports = me;
//# sourceMappingURL=index.js.map