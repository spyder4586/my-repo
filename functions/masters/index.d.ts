export default function masters(ctx: {
    method?: string;
    path?: string;
    query?: Record<string, string>;
    params?: Record<string, string>;
}): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: import("./common/masters-store").District[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: import("./common/masters-store").Unit[];
} | {
    status: number;
    body: {
        success: false;
        error: {
            code: import("./common/errors").ErrorCode;
            message: string;
            requestId: string | undefined;
        };
    };
}>;
