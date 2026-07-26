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
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { getDistricts, getUnits, getUnitsByDistrict } from './common/masters-store';

export default async function masters(ctx: {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
}) {
  const requestId = newRequestId();
  try {
    const { profile } = await requireAuth(ctx, requestId);
    const method = (ctx.method ?? 'GET').toUpperCase();
    const path = ctx.path ?? '';

    // GET /masters/districts
    if (method === 'GET' && path.startsWith('/districts')) {
      const all = await getDistricts(ctx);
      // Scope: non-state roles only see own district.
      const isState =
        profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
      const scoped = isState
        ? all
        : all.filter((d: any) => d.districtId === profile.districtId);
      logger.info('masters.districts', {
        requestId,
        role: profile.role,
        count: scoped.length,
      });
      return ok(scoped);
    }

    // GET /masters/units?districtId=
    if (method === 'GET' && path.startsWith('/units')) {
      const districtIdParam = ctx.query?.districtId;
      const requestedDistrictId = districtIdParam
        ? Number(districtIdParam)
        : undefined;
      const isState =
        profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
      let units;
      if (!isState) {
        // Non-state: lock to own district/unit.
        if (profile.districtId == null) {
          throw new ApiError('FORBIDDEN_SCOPE', 'District profile not set.', requestId);
        }
        if (
          requestedDistrictId != null &&
          requestedDistrictId !== profile.districtId
        ) {
          throw new ApiError(
            'FORBIDDEN_SCOPE',
            'Cannot list units outside your district.',
            requestId,
          );
        }
        units = await getUnitsByDistrict(ctx, profile.districtId);
      } else if (requestedDistrictId != null) {
        units = await getUnitsByDistrict(ctx, requestedDistrictId);
      } else {
        units = await getUnits(ctx);
      }
      logger.info('masters.units', {
        requestId,
        role: profile.role,
        count: units.length,
      });
      return ok(units);
    }

    throw new ApiError('NOT_FOUND', `Unknown masters route: ${method} ${path}`, requestId);
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = masters;
