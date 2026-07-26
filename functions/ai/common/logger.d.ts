export interface LogContext {
    requestId?: string;
    userId?: string;
    role?: string;
    route?: string;
    [key: string]: unknown;
}
export declare const logger: {
    debug: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    error: (msg: string, ctx?: LogContext) => void;
};
/** Generate a short correlation id for request tracing. */
export declare function newRequestId(): string;
