import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { catalyst, scopeWhereClause } from './common/datastore';

export default async function search(ctx: any) {
  const requestId = newRequestId();
  try {
    const { profile, scope } = await requireAuth(ctx, requestId);
    const app = catalyst(ctx) as any;
    
    const req = ctx.req;
    const method = req?.method || 'GET';
    const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
    const q = url.searchParams.get('q');
    
    if (method !== 'GET') {
      throw new ApiError('NOT_FOUND', `Method ${method} not allowed`);
    }
    
    if (!q || q.length < 3) {
      return ok({ cases: [], entities: [] });
    }

    logger.info(`search.query`, { requestId, role: profile.role, query: q });
    const zcql = app.zcql();
    
    // In Catalyst, ZCQL LIKE uses % syntax.
    // NOTE: ZCQL doesn't support complex full-text search easily without Catalyst Search component, 
    // but for Phase 1 we will use LIKE on CrimeNo and BriefFacts.
    const safeQ = q.replace(/'/g, "''"); // escape single quotes
    
    const caseQuery = `SELECT * FROM CaseMaster WHERE (CrimeNo LIKE '%${safeQ}%' OR BriefFacts LIKE '%${safeQ}%') AND ${scopeWhereClause(scope)} LIMIT 20`;
    const caseResult = await zcql.executeZCQLQuery(caseQuery).catch(() => []);
    
    // Basic entity search (Accused)
    const entityQuery = `SELECT * FROM Accused WHERE PersonName LIKE '%${safeQ}%' LIMIT 20`;
    const entityResult = await zcql.executeZCQLQuery(entityQuery).catch(() => []);
    
    const data = {
      cases: (caseResult || []).map((row: any) => row.CaseMaster),
      entities: (entityResult || []).map((row: any) => row.Accused)
    };
    
    return ok(data);
    
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = search;
