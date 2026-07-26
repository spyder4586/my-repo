"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = admin;
/**
 * Admin Function — users, jobs, import, audit.
 * Reference: IMPLEMENTATION2.md 5C, API_REFERENCE.md "Admin".
 * Status: scaffold (5C implements; admin APIs partial from 1B).
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
async function admin(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        await (0, auth_1.requireRoles)(['SUPER_ADMIN'], ctx, requestId);
        logger_1.logger.info('admin.stub', { requestId, route: '/admin' });
        return (0, errors_1.ok)({ message: 'admin endpoint scaffolded — implemented in sub-phase 5C' });
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = admin;
//# sourceMappingURL=index.js.map