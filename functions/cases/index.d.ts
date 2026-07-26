import { ApiError } from './common/errors';
export default function cases(ctx: any): Promise<{
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
export declare const notFound: (requestId?: string) => ApiError;
