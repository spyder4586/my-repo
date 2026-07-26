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

export class MastersRepository {
  constructor(private zcql: any) {}

  async getDistricts(): Promise<District[]> {
    const query = `SELECT * FROM District WHERE Active = true`;
    const result = await this.zcql.executeZCQLQuery(query);
    
    return (result || []).map((row: any) => ({
      districtId: row.District.DistrictID,
      districtName: row.District.DistrictName,
      stateId: row.District.StateID,
      active: row.District.Active
    }));
  }

  async getUnits(): Promise<Unit[]> {
    const query = `SELECT * FROM Unit WHERE Active = true`;
    const result = await this.zcql.executeZCQLQuery(query);
    
    return (result || []).map((row: any) => ({
      unitId: row.Unit.UnitID,
      unitName: row.Unit.UnitName,
      districtId: row.Unit.DistrictID,
      active: row.Unit.Active
    }));
  }

  async getUnitsByDistrict(districtId: number): Promise<Unit[]> {
    const units = await this.getUnits();
    return units.filter((u) => u.districtId === districtId);
  }
}
