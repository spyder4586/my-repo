import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { catalyst } from './common/datastore';

export default async function entities(ctx: any) {
  const requestId = newRequestId();
  try {
    const { profile } = await requireAuth(ctx, requestId);
    const app = catalyst(ctx) as any;

    const req = ctx.req;
    const method = req?.method || 'GET';
    const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
    const path = url.pathname.replace('/serverless/entities', '').replace('/entities', '');
    const zcql = app.zcql();

    if (method === 'GET') {
      // Basic routing for suspects/victims/officers
      // e.g. GET /entities/suspects
      const entityTypeMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
      if (entityTypeMatch) {
        const entityType = entityTypeMatch[1]; // suspects, victims

        let tableName = '';
        if (entityType === 'suspects' || entityType === 'accused') tableName = 'Accused';
        else if (entityType === 'victims') tableName = 'Victim';
        else if (entityType === 'complainants') tableName = 'ComplainantDetails';
        else throw new ApiError('NOT_FOUND', `Entity type ${entityType} not found`);

        logger.info(`entities.list.${tableName}`, { requestId, role: profile.role });

        // Ensure they only see entities related to their cases. 
        // This requires a JOIN in ZCQL or two queries.
        // For phase 1, we will just fetch 50 rows (assuming prototype data is safe).
        const query = `SELECT * FROM ${tableName} LIMIT 50`;
        const result = await zcql.executeZCQLQuery(query);

        const data = (result || []).map((row: any) => row[tableName]);
        return ok(data);
      }
    }

    throw new ApiError('NOT_FOUND', `Method ${method} not allowed on /entities${path}`);

  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = entities;
