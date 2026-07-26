export default function search(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        cases: any;
        entities: any;
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
