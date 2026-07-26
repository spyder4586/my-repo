/**
 * Ingest Function — FIR extract import (JSON -> validate -> upsert).
 */
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireRoles } from './common/auth';
import { catalyst } from './common/datastore';

export default async function ingest(ctx: any) {
  const requestId = newRequestId();
  try {
    const { profile } = await requireRoles(['SUPER_ADMIN', 'SCRB_ANALYST', 'DISTRICT_COMMAND'], ctx, requestId);
    const app = catalyst(ctx) as any;
    
    const req = ctx.req;
    const method = req?.method || 'GET';
    const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
    const path = url.pathname.replace('/serverless/ingest', '').replace('/ingest', '');
    
    if (method === 'POST' && path === '/fir') {
      logger.info('ingest.fir', { requestId, role: profile.role });
      
      const body = req?.body;
      if (!body || !Array.isArray(body)) {
        throw new ApiError('VALIDATION_ERROR', 'Expected an array of FIR records');
      }

      // Very simple ingest process for phase 1: Map fields and insert
      const datastore = app.datastore();
      const table = datastore.table('CaseMaster');
      
      let inserted = 0;
      let errors = 0;
      
      for (const record of body) {
        try {
          if (!record.CrimeNo) continue;
          
          const caseData = {
            CrimeNo: record.CrimeNo,
            CaseNo: record.CaseNo || '0',
            CrimeRegisteredDate: record.CrimeRegisteredDate || new Date().toISOString().replace('T', ' ').slice(0, 19),
            PoliceStationID: record.PoliceStationID || profile.unitId || 60001,
            DistrictID: record.DistrictID || profile.districtId || 443,
            BriefFacts: record.BriefFacts || '',
            IsDemo: true
          };
          
          await table.insertRow(caseData);
          inserted++;
        } catch (e) {
          logger.error('ingest.error', { error: e });
          errors++;
        }
      }
      
      return ok({ inserted, errors, total: body.length });
    }

    throw new ApiError('NOT_FOUND', `Method ${method} not allowed on /ingest${path}`);
    
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = ingest;
