"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = alerts;
/**
 * Alerts Function — spike/anomaly alert list + ack.
 * Reference: IMPLEMENTATION2.md 4D, API_REFERENCE.md "Alerts".
 * Status: scaffold (4D implements).
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
async function alerts(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        await (0, auth_1.requireAuth)(ctx, requestId);
        logger_1.logger.info('alerts.stub', { requestId, route: '/alerts' });
        return (0, errors_1.ok)({ message: 'alerts endpoint scaffolded — implemented in sub-phase 4D' });
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = alerts;
//# sourceMappingURL=index.js.map