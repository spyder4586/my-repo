import { Scope } from '../scope';
import { scopeWhereClause, sanitizeNumber, sanitizeZcqlDate } from '../datastore';

export class CaseRepository {
  constructor(private zcql: any, private datastore: any) {}

  async findById(caseId: string | number, scope: Scope) {
    const cleanId = sanitizeNumber(caseId);
    const query = `SELECT * FROM CaseMaster WHERE CaseMasterID = ${cleanId} AND ${scopeWhereClause(scope)}`;
    const result = await this.zcql.executeZCQLQuery(query);
    if (!result || result.length === 0) {
      return null;
    }
    return result[0].CaseMaster;
  }

  async list(scope: Scope, filters: { fromDate?: string | null, toDate?: string | null, category?: string | number | null }) {
    let whereClause = scopeWhereClause(scope);
    
    if (filters.fromDate) whereClause += ` AND CrimeRegisteredDate >= '${sanitizeZcqlDate(filters.fromDate)}'`;
    if (filters.toDate) whereClause += ` AND CrimeRegisteredDate <= '${sanitizeZcqlDate(filters.toDate)}'`;
    if (filters.category != null) whereClause += ` AND CrimeMajorHeadID = ${sanitizeNumber(filters.category)}`;

    const query = `SELECT * FROM CaseMaster WHERE ${whereClause} ORDER BY CrimeRegisteredDate DESC LIMIT 50`;
    const result = await this.zcql.executeZCQLQuery(query);
    
    return (result || []).map((row: any) => row.CaseMaster);
  }

  async create(caseData: any, scope: Scope) {
    const table = this.datastore.table('CaseMaster');
    
    const record = {
      ...caseData,
      CrimeRegisteredDate: caseData.CrimeRegisteredDate || new Date().toISOString().replace('T', ' ').slice(0, 19),
      PoliceStationID: caseData.PoliceStationID || scope.unitId,
      DistrictID: caseData.DistrictID || scope.districtId,
      IsDemo: true
    };
    
    return await table.insertRow(record);
  }
}
