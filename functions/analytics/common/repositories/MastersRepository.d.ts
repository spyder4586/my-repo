export interface District {
    districtId: number;
    districtName: string;
    stateId: number;
    active: boolean;
}
export interface Unit {
    unitId: number;
    unitName: string;
    districtId: number;
    active: boolean;
}
export declare class MastersRepository {
    private zcql;
    constructor(zcql: any);
    getDistricts(): Promise<District[]>;
    getUnits(): Promise<Unit[]>;
    getUnitsByDistrict(districtId: number): Promise<Unit[]>;
}
