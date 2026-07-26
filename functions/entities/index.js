"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = entities;
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const datastore_1 = require("./common/datastore");
async function entities(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile } = await (0, auth_1.requireAuth)(ctx, requestId);
        const app = (0, datastore_1.catalyst)(ctx);
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
                if (entityType === 'suspects' || entityType === 'accused')
                    tableName = 'Accused';
                else if (entityType === 'victims')
                    tableName = 'Victim';
                else if (entityType === 'complainants')
                    tableName = 'ComplainantDetails';
                else
                    throw new errors_1.ApiError('NOT_FOUND', `Entity type ${entityType} not found`);
                logger_1.logger.info(`entities.list.${tableName}`, { requestId, role: profile.role });
                // Ensure they only see entities related to their cases. 
                // This requires a JOIN in ZCQL or two queries.
                // For phase 1, we will just fetch 50 rows (assuming prototype data is safe).
                const query = `SELECT * FROM ${tableName} LIMIT 50`;
                const result = await zcql.executeZCQLQuery(query);
                const data = (result || []).map((row) => row[tableName]);
                return (0, errors_1.ok)(data);
            }
        }
        throw new errors_1.ApiError('NOT_FOUND', `Method ${method} not allowed on /entities${path}`);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = entities;
//# sourceMappingURL=index.js.map