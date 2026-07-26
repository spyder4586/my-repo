"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = search;
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const datastore_1 = require("./common/datastore");
async function search(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile, scope } = await (0, auth_1.requireAuth)(ctx, requestId);
        const app = (0, datastore_1.catalyst)(ctx);
        const req = ctx.req;
        const method = req?.method || 'GET';
        const url = new URL(req?.url || '/', `http://${req?.headers?.host || 'localhost'}`);
        const q = url.searchParams.get('q');
        if (method !== 'GET') {
            throw new errors_1.ApiError('NOT_FOUND', `Method ${method} not allowed`);
        }
        if (!q || q.length < 3) {
            return (0, errors_1.ok)({ cases: [], entities: [] });
        }
        logger_1.logger.info(`search.query`, { requestId, role: profile.role, query: q });
        const zcql = app.zcql();
        // In Catalyst, ZCQL LIKE uses % syntax.
        // NOTE: ZCQL doesn't support complex full-text search easily without Catalyst Search component, 
        // but for Phase 1 we will use LIKE on CrimeNo and BriefFacts.
        const safeQ = q.replace(/'/g, "''"); // escape single quotes
        const caseQuery = `SELECT * FROM CaseMaster WHERE (CrimeNo LIKE '%${safeQ}%' OR BriefFacts LIKE '%${safeQ}%') AND ${(0, datastore_1.scopeWhereClause)(scope)} LIMIT 20`;
        const caseResult = await zcql.executeZCQLQuery(caseQuery).catch(() => []);
        // Basic entity search (Accused)
        const entityQuery = `SELECT * FROM Accused WHERE PersonName LIKE '%${safeQ}%' LIMIT 20`;
        const entityResult = await zcql.executeZCQLQuery(entityQuery).catch(() => []);
        const data = {
            cases: (caseResult || []).map((row) => row.CaseMaster),
            entities: (entityResult || []).map((row) => row.Accused)
        };
        return (0, errors_1.ok)(data);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = search;
//# sourceMappingURL=index.js.map