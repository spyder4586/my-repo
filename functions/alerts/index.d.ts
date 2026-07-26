export default function alerts(ctx: unknown): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        message: string;
    };
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
