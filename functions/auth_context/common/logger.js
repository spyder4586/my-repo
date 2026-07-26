"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.newRequestId = newRequestId;
/**
 * Structured logger. No PII is ever logged (no BriefFacts, no names).
 * Reference: BACKEND_ARCHITECTURE.md #10 Observability, SECURITY.md
 */
const config_1 = require("./config");
function emit(level, msg, ctx) {
    const lvl = (0, config_1.config)().logLevel;
    if (level === 'debug' && lvl !== 'debug')
        return;
    const line = JSON.stringify({
        level,
        msg,
        ts: new Date().toISOString(),
        ...ctx,
    });
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else
        console.log(line); // eslint-disable-line no-console
}
exports.logger = {
    debug: (msg, ctx) => emit('debug', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),
};
/** Generate a short correlation id for request tracing. */
function newRequestId() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}
//# sourceMappingURL=logger.js.map