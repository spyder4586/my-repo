"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = masters;
/**
 * Masters Function — district/unit/crime-head/act/section lookups.
 * Reference: IMPLEMENTATION2.md 1C, API_REFERENCE.md "Masters".
 *
 * Endpoints (Advanced I/O via /api/v1/masters/*):
 *   GET /masters/districts
 *   GET /masters/units?districtId=
 *
 * Scope: non-SCRB roles receive own district/unit only (API_REFERENCE).
 * Full masters set (crime-heads, acts, sections...) added in 1C.
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const masters_store_1 = require("./common/masters-store");
async function masters(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile } = await (0, auth_1.requireAuth)(ctx, requestId);
        const method = (ctx.method ?? 'GET').toUpperCase();
        const path = ctx.path ?? '';
        // GET /masters/districts
        if (method === 'GET' && path.startsWith('/districts')) {
            const all = await (0, masters_store_1.getDistricts)(ctx);
            // Scope: non-state roles only see own district.
            const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
            const scoped = isState
                ? all
                : all.filter((d) => d.districtId === profile.districtId);
            logger_1.logger.info('masters.districts', {
                requestId,
                role: profile.role,
                count: scoped.length,
            });
            return (0, errors_1.ok)(scoped);
        }
        // GET /masters/units?districtId=
        if (method === 'GET' && path.startsWith('/units')) {
            const districtIdParam = ctx.query?.districtId;
            const requestedDistrictId = districtIdParam
                ? Number(districtIdParam)
                : undefined;
            const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
            let units;
            if (!isState) {
                // Non-state: lock to own district/unit.
                if (profile.districtId == null) {
                    throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'District profile not set.', requestId);
                }
                if (requestedDistrictId != null &&
                    requestedDistrictId !== profile.districtId) {
                    throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'Cannot list units outside your district.', requestId);
                }
                units = await (0, masters_store_1.getUnitsByDistrict)(ctx, profile.districtId);
            }
            else if (requestedDistrictId != null) {
                units = await (0, masters_store_1.getUnitsByDistrict)(ctx, requestedDistrictId);
            }
            else {
                units = await (0, masters_store_1.getUnits)(ctx);
            }
            logger_1.logger.info('masters.units', {
                requestId,
                role: profile.role,
                count: units.length,
            });
            return (0, errors_1.ok)(units);
        }
        throw new errors_1.ApiError('NOT_FOUND', `Unknown masters route: ${method} ${path}`, requestId);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = masters;
//# sourceMappingURL=index.js.map