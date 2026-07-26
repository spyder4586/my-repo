export default function ingest(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        inserted: number;
        errors: number;
        total: number;
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
