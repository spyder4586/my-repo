/**
 * Error envelope + standard codes for KSP API.
 * Reference: API_REFERENCE.md "Common error codes", API.md, ADR-012.
 */
export type ErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN_ROLE' | 'FORBIDDEN_SCOPE' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'DEPENDENCY_UNAVAILABLE' | 'PROFILE_REQUIRED';
export declare class ApiError extends Error {
    code: ErrorCode;
    httpStatus: number;
    requestId?: string;
    constructor(code: ErrorCode, message: string, requestId?: string);
}
/** Success response envelope. */
export declare function ok<T>(data: T, meta?: Record<string, unknown>): {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: T;
};
/** Build a failure envelope. */
export declare function fail(code: ErrorCode, message: string, requestId?: string): {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        requestId: string | undefined;
    };
};
/** Serialize an error into an HTTP response shape for Function handlers. */
export declare function toResponse(err: unknown, requestId?: string): {
    status: number;
    body: {
        success: false;
        error: {
            code: ErrorCode;
            message: string;
            requestId: string | undefined;
        };
    };
};
