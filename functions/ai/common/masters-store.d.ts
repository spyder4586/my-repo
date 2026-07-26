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
export declare function getDistricts(ctx: any): Promise<District[]>;
export declare function getUnits(ctx: any): Promise<Unit[]>;
export declare function getUnitsByDistrict(ctx: any, districtId: number): Promise<Unit[]>;
