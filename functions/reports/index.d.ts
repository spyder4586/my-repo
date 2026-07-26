/** Templates allowed by the API contract (API_REFERENCE.md "Reports"). */
export declare const REPORT_TEMPLATES: readonly ["DISTRICT_WEEKLY", "HOTSPOT_BRIEF", "CASE_NETWORK_PACK"];
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];
/** ReportJob lifecycle status. */
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
export interface ReportJob {
    jobId: string;
    template: ReportTemplate;
    filters: ReportFilters;
    status: JobStatus;
    createdBy: string;
    createdByRole: string;
    piiIncluded: boolean;
    createdAt: string;
    completedAt?: string;
    downloadUrl?: string;
    fileSizeBytes?: number;
    errorMessage?: string;
}
export interface ReportFilters {
    districtId?: number;
    unitId?: number;
    caseMasterId?: number;
    dateFrom: string;
    dateTo: string;
    hops?: number;
}
/**
 * Main handler. Dispatches by method + path.
 * ctx shape (Catalyst Advanced I/O): { method, path, params, query, body, ... }
 */
export default function reports(ctx: {
    method?: string;
    path?: string;
    params?: Record<string, string>;
    body?: unknown;
}): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        jobId: string;
        status: JobStatus;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        jobId: string;
        template: "DISTRICT_WEEKLY" | "HOTSPOT_BRIEF" | "CASE_NETWORK_PACK";
        status: JobStatus;
        createdBy: string;
        createdByRole: string;
        createdAt: string;
        completedAt: string | undefined;
        fileSizeBytes: number | undefined;
    }[];
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
