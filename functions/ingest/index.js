"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ingest;
/**
 * Ingest Function — FIR extract import (JSON -> validate -> upsert).
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const datastore_1 = require("./common/datastore");
async function ingest(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile } = await (0, auth_1.requireRoles)(['SUPER_ADMIN', 'SCRB_ANALYST', 'DISTRICT_COMMAND'], ctx, requestId);
        const app = (0, datastore_1.catalyst)(ctx);
        const req = ctx.req;
        const method = req?.method || 'GET';
        const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
        const path = url.pathname.replace('/serverless/ingest', '').replace('/ingest', '');
        if (method === 'POST' && path === '/fir') {
            logger_1.logger.info('ingest.fir', { requestId, role: profile.role });
            const body = req?.body;
            if (!body || !Array.isArray(body)) {
                throw new errors_1.ApiError('VALIDATION_ERROR', 'Expected an array of FIR records');
            }
            // Very simple ingest process for phase 1: Map fields and insert
            const datastore = app.datastore();
            const table = datastore.table('CaseMaster');
            let inserted = 0;
            let errors = 0;
            for (const record of body) {
                try {
                    if (!record.CrimeNo)
                        continue;
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
                }
                catch (e) {
                    logger_1.logger.error('ingest.error', { error: e });
                    errors++;
                }
            }
            return (0, errors_1.ok)({ inserted, errors, total: body.length });
        }
        throw new errors_1.ApiError('NOT_FOUND', `Method ${method} not allowed on /ingest${path}`);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = ingest;
//# sourceMappingURL=index.js.map