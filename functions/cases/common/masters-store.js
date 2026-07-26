"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDistricts = getDistricts;
exports.getUnits = getUnits;
exports.getUnitsByDistrict = getUnitsByDistrict;
/**
 * In-memory master data store.
 * Temporary stand-in until Catalyst Data Store is wired in sub-phase 1A.
 * Loads seed JSON from datastore/seeds/*.
 *
 * Reference: DATABASE_DESIGN.md #2.10 (District/Unit), API_REFERENCE.md "Masters".
 */
const datastore_1 = require("./datastore");
const MastersRepository_1 = require("./repositories/MastersRepository");
async function getDistricts(ctx) {
    const app = (0, datastore_1.catalyst)(ctx);
    const repo = new MastersRepository_1.MastersRepository(app.zcql());
    return await repo.getDistricts();
}
async function getUnits(ctx) {
    const app = (0, datastore_1.catalyst)(ctx);
    const repo = new MastersRepository_1.MastersRepository(app.zcql());
    return await repo.getUnits();
}
async function getUnitsByDistrict(ctx, districtId) {
    const units = await getUnits(ctx);
    return units.filter((u) => u.districtId === districtId);
}
//# sourceMappingURL=masters-store.js.map