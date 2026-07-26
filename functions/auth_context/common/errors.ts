/**
 * Error envelope + standard codes for KSP API.
 * Reference: API_REFERENCE.md "Common error codes", API.md, ADR-012.
 */

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_SCOPE'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PROFILE_REQUIRED';

const HTTP_BY_CODE: Record<ErrorCode, number> = {
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

export class ApiError extends Error {
  code: ErrorCode;
  httpStatus: number;
  requestId?: string;

  constructor(code: ErrorCode, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = HTTP_BY_CODE[code];
    this.requestId = requestId;
  }
}

/** Success response envelope. */
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true as const, data, ...(meta ? { meta } : {}) };
}

/** Build a failure envelope. */
export function fail(
  code: ErrorCode,
  message: string,
  requestId?: string,
) {
  return {
    success: false as const,
    error: { code, message, requestId },
  };
}

/** Serialize an error into an HTTP response shape for Function handlers. */
export function toResponse(err: unknown, requestId?: string) {
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
