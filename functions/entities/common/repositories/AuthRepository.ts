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

export class AuthRepository {
  constructor(private zcql: any) {}

  async getActiveProfileByCatalystId(catalystUserId: string): Promise<UserProfileRow | null> {
    const query = `SELECT * FROM App_UserProfile WHERE CatalystUserId = '${catalystUserId}' AND Active = true`;
    const result = await this.zcql.executeZCQLQuery(query);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0].App_UserProfile as UserProfileRow;
  }
}
