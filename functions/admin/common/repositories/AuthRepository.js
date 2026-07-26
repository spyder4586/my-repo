"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
class AuthRepository {
    zcql;
    constructor(zcql) {
        this.zcql = zcql;
    }
    async getActiveProfileByCatalystId(catalystUserId) {
        const query = `SELECT * FROM App_UserProfile WHERE CatalystUserId = '${catalystUserId}' AND Active = true`;
        const result = await this.zcql.executeZCQLQuery(query);
        if (!result || result.length === 0) {
            return null;
        }
        return result[0].App_UserProfile;
    }
}
exports.AuthRepository = AuthRepository;
//# sourceMappingURL=AuthRepository.js.map