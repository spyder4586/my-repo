"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MastersRepository = void 0;
class MastersRepository {
    zcql;
    constructor(zcql) {
        this.zcql = zcql;
    }
    async getDistricts() {
        const query = `SELECT * FROM District WHERE Active = true`;
        const result = await this.zcql.executeZCQLQuery(query);
        return (result || []).map((row) => ({
            districtId: row.District.DistrictID,
            districtName: row.District.DistrictName,
            stateId: row.District.StateID,
            active: row.District.Active
        }));
    }
    async getUnits() {
        const query = `SELECT * FROM Unit WHERE Active = true`;
        const result = await this.zcql.executeZCQLQuery(query);
        return (result || []).map((row) => ({
            unitId: row.Unit.UnitID,
            unitName: row.Unit.UnitName,
            districtId: row.Unit.DistrictID,
            active: row.Unit.Active
        }));
    }
    async getUnitsByDistrict(districtId) {
        const units = await this.getUnits();
        return units.filter((u) => u.districtId === districtId);
    }
}
exports.MastersRepository = MastersRepository;
//# sourceMappingURL=MastersRepository.js.map