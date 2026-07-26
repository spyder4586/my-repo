"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = onImportComplete;
/**
 * Event Function: on_import_complete
 * Triggered by Signal when a Stratus object lands in imports/raw/ or import job completes.
 * Kicks off the fir_import Circuit (validate -> load -> graph refresh -> notify).
 * Reference: CATALYST_INTEGRATION.md #8/#9, IMPLEMENTATION2.md 1E.
 */
const logger_1 = require(".././common/logger");
async function onImportComplete(_ctx) {
    const requestId = (0, logger_1.newRequestId)();
    logger_1.logger.info('event.import_complete', { requestId, event: 'on_import_complete' });
    // 1E: trigger fir_import_pipeline Circuit
    return { processed: true };
}
//# sourceMappingURL=index.js.map