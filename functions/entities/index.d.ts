export default function entities(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: any;
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
