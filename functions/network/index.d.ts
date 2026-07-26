export default function network(ctx: any): Promise<{
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        id: string;
        memberCount: number;
        members: Array<{
            personKey: string;
            personName: string;
        }>;
        mostCentralNode: {
            personKey: string;
            personName: string;
        };
        sharedEdgeTypes: string[];
    }[];
} | {
    meta?: Record<string, unknown> | undefined;
    success: true;
    data: {
        elements: {
            nodes: {
                data: {
                    id: string;
                    label: string;
                    type: string;
                    risk: string;
                };
            }[];
            edges: {
                data: {
                    id: string;
                    source: string;
                    target: string;
                    label: string;
                };
            }[];
        };
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
