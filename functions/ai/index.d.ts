export default function ai(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        job: string;
        status: string;
        scannedRows: number;
        triggeredAt: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        job: string;
        status: string;
        message: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        job: string;
        status: string;
        httpStatus: number | null;
        triggeredAt: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        source: string;
        status: string;
        modelVersion: string;
        trainedAt: string;
        prediction: {} | null;
        rawResponse: Record<string, unknown>;
        message: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        source: string;
        status: string;
        modelVersion: null;
        message: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: any[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        source: string;
        analysis: {
            keywords: any;
            sentiment: any;
        };
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
