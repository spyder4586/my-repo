import { Scope } from '../scope';
export declare class CaseRepository {
    private zcql;
    private datastore;
    constructor(zcql: any, datastore: any);
    findById(caseId: string | number, scope: Scope): Promise<any>;
    list(scope: Scope, filters: {
        fromDate?: string | null;
        toDate?: string | null;
        category?: string | number | null;
    }): Promise<any>;
    create(caseData: any, scope: Scope): Promise<any>;
}
