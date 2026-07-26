interface Hotspot {
    id: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    caseCount: number;
    timeOfDay: 'night' | 'morning' | 'afternoon' | 'evening';
    topModusOperandi: string;
    districtId: number;
}
interface AlertItem {
    id: string;
    title: string;
    location: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    timestamp: string;
    districtId?: number;
    crimeCategory?: string;
    currentCount: number;
    baselineCount: number;
    spikeRatio: number;
}
interface TrendPoint {
    label: string;
    ipc: number;
    sll: number;
    cyber: number;
}
export default function analytics(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        job: string;
        status: string;
        triggeredAt: string;
    };
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: Hotspot[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: AlertItem[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: TrendPoint[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        pearsonR: number | undefined;
        districtId: number;
        districtName: string;
        crimeCount: number;
        urbanizationPct: number;
        literacyRate: number;
        economicIndex: number;
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
export {};
