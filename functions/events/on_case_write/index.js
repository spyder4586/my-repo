"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = onCaseWrite;
/**
 * Event Function: on_case_write
 * Triggered by Signal when CaseMaster row is inserted/updated.
 * Marks affected unit-day aggregates dirty for incremental rebuild.
 * Reference: CATALYST_INTEGRATION.md #8, BACKEND_ARCHITECTURE.md #6.
 */
const logger_1 = require(".././common/logger");
async function onCaseWrite(_ctx) {
    const requestId = (0, logger_1.newRequestId)();
    logger_1.logger.info('event.case_write', { requestId, event: 'on_case_write' });
    // 1E/2B: touch Agg dirty flags -> recompute aggregates async
    return { processed: true };
}
//# sourceMappingURL=index.js.map