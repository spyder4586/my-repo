"use strict";
/**
 * Error envelope + standard codes for KSP API.
 * Reference: API_REFERENCE.md "Common error codes", API.md, ADR-012.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.ok = ok;
exports.fail = fail;
exports.toResponse = toResponse;
const HTTP_BY_CODE = {
    UNAUTHORIZED: 401,
    FORBIDDEN_ROLE: 403,
    FORBIDDEN_SCOPE: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL: 500,
    DEPENDENCY_UNAVAILABLE: 503,
    PROFILE_REQUIRED: 401,
};
class ApiError extends Error {
    code;
    httpStatus;
    requestId;
    constructor(code, message, requestId) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.httpStatus = HTTP_BY_CODE[code];
        this.requestId = requestId;
    }
}
exports.ApiError = ApiError;
/** Success response envelope. */
function ok(data, meta) {
    return { success: true, data, ...(meta ? { meta } : {}) };
}
/** Build a failure envelope. */
function fail(code, message, requestId) {
    return {
        success: false,
        error: { code, message, requestId },
    };
}
/** Serialize an error into an HTTP response shape for Function handlers. */
function toResponse(err, requestId) {
    if (err instanceof ApiError) {
        return {
            status: err.httpStatus,
            body: fail(err.code, err.message, err.requestId ?? requestId),
        };
    }
    const message = err instanceof Error ? err.message : 'Internal error';
    return {
        status: 500,
        body: fail('INTERNAL', message, requestId),
    };
}
//# sourceMappingURL=errors.js.map