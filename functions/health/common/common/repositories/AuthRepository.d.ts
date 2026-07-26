import type { Role } from '../rbac';
export interface UserProfileRow {
    UserProfileID: number;
    CatalystUserId: string;
    EmployeeID?: number | null;
    Role: Role;
    DistrictID?: number | null;
    UnitID?: number | null;
    Active: boolean;
}
export declare class AuthRepository {
    private zcql;
    constructor(zcql: any);
    getActiveProfileByCatalystId(catalystUserId: string): Promise<UserProfileRow | null>;
}
