"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
exports.default = cases;
/**
 * Cases Function — CaseMaster search + Case 360°.
 * Endpoints: GET /cases, /cases/{id}, /cases/by-crime-no/{crimeNo},
 *            /cases/{id}/people, /acts, /arrests, /chargesheets
 * Reference: IMPLEMENTATION2.md 1D, API_REFERENCE.md "Cases".
 * Status: scaffold (1D implements).
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const datastore_1 = require("./common/datastore");
const CaseRepository_1 = require("./common/repositories/CaseRepository");
async function cases(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile, scope } = await (0, auth_1.requireAuth)(ctx, requestId);
        const app = (0, datastore_1.catalyst)(ctx);
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
                logger_1.logger.info('cases.get', { requestId, caseId });
                const repo = new CaseRepository_1.CaseRepository(zcql, app.datastore());
                const result = await repo.findById(caseId, scope);
                if (!result)
                    throw (0, exports.notFound)(requestId);
                // Return single case
                return (0, errors_1.ok)(result);
            }
            // GET /cases
            logger_1.logger.info('cases.list', { requestId, role: profile.role });
            const repo = new CaseRepository_1.CaseRepository(zcql, app.datastore());
            const filters = {
                fromDate: url.searchParams.get('from'),
                toDate: url.searchParams.get('to'),
                category: url.searchParams.get('category')
            };
            const data = await repo.list(scope, filters);
            return (0, errors_1.ok)(data);
        }
        if (method === 'POST') {
            logger_1.logger.info('cases.create', { requestId, role: profile.role });
            const body = req?.body || {};
            if (!body.CrimeNo) {
                throw new errors_1.ApiError('VALIDATION_ERROR', 'CrimeNo is required');
            }
            const repo = new CaseRepository_1.CaseRepository(zcql, app.datastore());
            const inserted = await repo.create(body, scope);
            return (0, errors_1.ok)(inserted);
        }
        throw new errors_1.ApiError('NOT_FOUND', `Method ${method} not allowed on /cases${path}`);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
// Helper reserved for 1D to throw consistent NOT_FOUND on out-of-scope (ADR-012).
const notFound = (requestId) => new errors_1.ApiError('NOT_FOUND', 'Case not found.', requestId);
exports.notFound = notFound;
module.exports = cases;
//# sourceMappingURL=index.js.map