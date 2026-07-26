/**
 * Cases Function — CaseMaster search + Case 360°.
 * Endpoints: GET /cases, /cases/{id}, /cases/by-crime-no/{crimeNo},
 *            /cases/{id}/people, /acts, /arrests, /chargesheets
 * Reference: IMPLEMENTATION2.md 1D, API_REFERENCE.md "Cases".
 * Status: scaffold (1D implements).
 */
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { catalyst } from './common/datastore';
import { CaseRepository } from './common/repositories/CaseRepository';

export default async function cases(ctx: any) {
  const requestId = newRequestId();
  try {
    const { profile, scope } = await requireAuth(ctx, requestId);
    const app = catalyst(ctx) as any;
    
    // Simple router based on HTTP method and path
    const req = ctx.req;
    const method = req?.method || 'GET';
    const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
    const path = url.pathname.replace('/serverless/cases', '').replace('/cases', ''); // normalize path
    const zcql = app.zcql();

    if (method === 'GET') {
      // GET /cases/:id
      const idMatch = path.match(/^\/(\d+)$/);
      if (idMatch) {
        const caseId = idMatch[1];
        logger.info('cases.get', { requestId, caseId });
        const repo = new CaseRepository(zcql, app.datastore());
        const result = await repo.findById(caseId, scope);
        if (!result) throw notFound(requestId);
        
        // Return single case
        return ok(result);
      }

      // GET /cases
      logger.info('cases.list', { requestId, role: profile.role });
      const repo = new CaseRepository(zcql, app.datastore());
      const filters = {
        fromDate: url.searchParams.get('from'),
        toDate: url.searchParams.get('to'),
        category: url.searchParams.get('category')
      };

      const data = await repo.list(scope, filters);
      return ok(data);
    } 
    
    if (method === 'POST') {
      logger.info('cases.create', { requestId, role: profile.role });
      const body = req?.body || {};
      
      if (!body.CrimeNo) {
        throw new ApiError('VALIDATION_ERROR', 'CrimeNo is required');
      }

      const repo = new CaseRepository(zcql, app.datastore());
      const inserted = await repo.create(body, scope);
      return ok(inserted);
    }

    throw new ApiError('NOT_FOUND', `Method ${method} not allowed on /cases${path}`);
    
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

// Helper reserved for 1D to throw consistent NOT_FOUND on out-of-scope (ADR-012).
export const notFound = (requestId?: string) =>
  new ApiError('NOT_FOUND', 'Case not found.', requestId);

module.exports = cases;
