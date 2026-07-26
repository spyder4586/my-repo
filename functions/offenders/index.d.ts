interface OffenderProfile {
    personKey: string;
    personName: string;
    priorArrests: number;
    totalCases: number;
    districtsActive: number[];
    modusOperandiTags: Array<{
        mo: string;
        count: number;
    }>;
    caseHistory: Array<{
        caseMasterId: number;
        crimeNo: string;
        districtId: number;
        crimeCategory: string;
        modusOperandi: string;
        registeredDate: string;
        status: string;
    }>;
}
export default function offenders(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: OffenderProfile[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: OffenderProfile;
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
export {};
