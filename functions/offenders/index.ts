/**
 * Offenders Function — repeat-offender tracking, MO patterns, cross-case profile.
 * Phase 1.5 (2026-07-25).
 *
 * Endpoints (routed via API Gateway /api/v1/offenders/*):
 *   GET /offenders             → list all offenders with case counts + MO tags
 *   GET /offenders/{personKey}  → single offender's full cross-case profile
 *
 * Joins OffenderMaster + Accused + CaseMaster via ZCQL to build the profile.
 *
 * NOTE — PII / legal sign-off: this feature tracks individuals across
 * jurisdictions using name-based PersonKey matching (no biometric/Aadhaar).
 * Production use requires PII-handling and legal sign-off per the audit's
 * note. The schema is designed so a stronger identifier can replace PersonKey
 * later without code changes.
 */
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { catalyst, scopeWhereClause, sanitizeZcqlString } from './common/datastore';

interface OffenderProfile {
  personKey: string;
  personName: string;
  priorArrests: number;
  totalCases: number;
  districtsActive: number[];
  modusOperandiTags: Array<{ mo: string; count: number }>;
  caseHistory: Array<{
    caseMasterId: number;
    crimeNo: string;
    districtId: number;
    crimeCategory: string;
    modusOperandi: string;
    registeredDate: string;
    status: string;
  }>;
}

export default async function offenders(ctx: any) {
  const requestId = newRequestId();
  try {
    const { scope } = await requireAuth(ctx, requestId);
    const app = catalyst(ctx) as any;
    const zcql = app.zcql();
    const scopeClause = scopeWhereClause(scope);

    const req = ctx.req || {};
    const url = new URL(req.url || '/offenders', `http://${req.headers?.host || 'localhost'}`);
    const path = url.pathname.replace(/\/$/, '');

    // GET /offenders — list all offenders with aggregated case counts.
    if (path === '/offenders' || path === '/offenders/') {
      // Join OffenderMaster with Accused to count cases per offender.
      const q = `SELECT o.PersonKey, o.PersonName, o.PriorArrests, COUNT(a.CaseMasterID) AS CaseCount FROM OffenderMaster o LEFT JOIN Accused a ON o.PersonKey = a.PersonKey GROUP BY o.PersonKey, o.PersonName, o.PriorArrests`;
      const rows: any[] = (await zcql.executeZCQLQuery(q).catch(() => [])) || [];

      const profiles: OffenderProfile[] = [];
      for (const r of rows) {
        const row = r.OffenderMaster || r;
        const personKey = row.PersonKey;
        const personName = row.PersonName;
        const priorArrests = Number(row.PriorArrests ?? 0);
        profiles.push(await buildProfile(zcql, scopeClause, personKey, personName, priorArrests));
      }
      logger.info('offenders.list', { requestId, count: profiles.length });
      return ok(profiles);
    }

    // GET /offenders/{personKey} — single offender's full profile.
    const match = path.match(/^\/offenders\/([^/]+)$/);
    if (match) {
      const personKey = decodeURIComponent(match[1]);
      const q = `SELECT PersonKey, PersonName, PriorArrests FROM OffenderMaster WHERE PersonKey = '${sanitizeZcqlString(personKey)}' LIMIT 1`;
      const rows: any[] = (await zcql.executeZCQLQuery(q).catch(() => [])) || [];
      const row = rows[0]?.OffenderMaster ?? rows[0];
      if (!row) throw new ApiError('NOT_FOUND', `Offender ${personKey} not found`, requestId);

      const profile = await buildProfile(zcql, scopeClause, row.PersonKey, row.PersonName, Number(row.PriorArrests ?? 0));
      logger.info('offenders.get', { requestId, personKey, cases: profile.totalCases });
      return ok(profile);
    }

    throw new ApiError('NOT_FOUND', `Offenders route not found: ${path}`, requestId);
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

/** Build a full offender profile by joining Accused + CaseMaster via ZCQL. */
async function buildProfile(
  zcql: any,
  scopeClause: string,
  personKey: string,
  personName: string,
  priorArrests: number,
): Promise<OffenderProfile> {
  // Fetch all case links for this offender.
  const linkQ = `SELECT a.CaseMasterID, a.Status, c.CrimeNo, c.DistrictID, c.BriefFacts, c.ModusOperandi, c.CrimeRegisteredDate FROM Accused a LEFT JOIN CaseMaster c ON a.CaseMasterID = c.CaseMasterID WHERE a.PersonKey = '${sanitizeZcqlString(personKey)}' AND ${scopeClause}`;
  const rows: any[] = (await zcql.executeZCQLQuery(linkQ).catch(() => [])) || [];

  const caseHistory: OffenderProfile['caseHistory'] = [];
  const moMap = new Map<string, number>();
  const districts = new Set<number>();

  for (const r of rows) {
    const link = r.Accused || r;
    const cm = r.CaseMaster || r;
    const mo = cm.ModusOperandi ?? '';
    const did = Number(cm.DistrictID ?? 0);
    caseHistory.push({
      caseMasterId: Number(link.CaseMasterID),
      crimeNo: cm.CrimeNo ?? '',
      districtId: did,
      crimeCategory: cm.BriefFacts ?? '',
      modusOperandi: mo,
      registeredDate: cm.CrimeRegisteredDate ?? '',
      status: link.Status ?? '',
    });
    if (mo) moMap.set(mo, (moMap.get(mo) ?? 0) + 1);
    if (did) districts.add(did);
  }

  return {
    personKey,
    personName,
    priorArrests,
    totalCases: caseHistory.length,
    districtsActive: Array.from(districts),
    modusOperandiTags: Array.from(moMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([mo, count]) => ({ mo, count })),
    caseHistory: caseHistory.sort((a, b) => b.registeredDate.localeCompare(a.registeredDate)),
  };
}

module.exports = offenders;
