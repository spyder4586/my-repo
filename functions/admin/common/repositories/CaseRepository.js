"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseRepository = void 0;
const datastore_1 = require("../datastore");
class CaseRepository {
    zcql;
    datastore;
    constructor(zcql, datastore) {
        this.zcql = zcql;
        this.datastore = datastore;
    }
    async findById(caseId, scope) {
        const cleanId = (0, datastore_1.sanitizeNumber)(caseId);
        const query = `SELECT * FROM CaseMaster WHERE CaseMasterID = ${cleanId} AND ${(0, datastore_1.scopeWhereClause)(scope)}`;
        const result = await this.zcql.executeZCQLQuery(query);
        if (!result || result.length === 0) {
            return null;
        }
        return result[0].CaseMaster;
    }
    async list(scope, filters) {
        let whereClause = (0, datastore_1.scopeWhereClause)(scope);
        if (filters.fromDate)
            whereClause += ` AND CrimeRegisteredDate >= '${(0, datastore_1.sanitizeZcqlDate)(filters.fromDate)}'`;
        if (filters.toDate)
            whereClause += ` AND CrimeRegisteredDate <= '${(0, datastore_1.sanitizeZcqlDate)(filters.toDate)}'`;
        if (filters.category != null)
            whereClause += ` AND CrimeMajorHeadID = ${(0, datastore_1.sanitizeNumber)(filters.category)}`;
        const query = `SELECT * FROM CaseMaster WHERE ${whereClause} ORDER BY CrimeRegisteredDate DESC LIMIT 50`;
        const result = await this.zcql.executeZCQLQuery(query);
        return (result || []).map((row) => row.CaseMaster);
    }
    async create(caseData, scope) {
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
exports.CaseRepository = CaseRepository;
//# sourceMappingURL=CaseRepository.js.map