"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalyst = catalyst;
exports.scopeWhereClause = scopeWhereClause;
exports.sanitizeZcqlString = sanitizeZcqlString;
exports.sanitizeZcqlDate = sanitizeZcqlDate;
exports.sanitizeNumber = sanitizeNumber;
const scope_1 = require("./scope");
/** Lazily resolve the Catalyst app (initialized once per invocation). */
function catalyst(req) {
    try {
        // Dynamic require so local Vitest test environment does not hard fail without SDK
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sdk = require('zcatalyst-sdk-node');
        return sdk.initialize(req);
    }
    catch {
        throw new Error('Catalyst SDK not initialized or zcatalyst-sdk-node package not loaded.');
    }
}
/** Build a ZCQL/ORM WHERE clause fragment from a CaseScopeFilter. */
function scopeWhereClause(scope) {
    const f = (0, scope_1.caseScopeFilter)(scope);
    if (f.denyAll)
        return '1 = 0';
    if (f.state)
        return '1 = 1';
    const parts = [];
    if (f.districtId != null)
        parts.push(`DistrictID = ${f.districtId}`);
    if (f.unitId != null)
        parts.push(`PoliceStationID = ${f.unitId}`);
    if (f.employeeOrUnit) {
        parts.push(`(PolicePersonID = ${f.employeeOrUnit.employeeId} OR PoliceStationID = ${f.employeeOrUnit.unitId})`);
    }
    if (f.demoOnly)
        parts.push('IsDemo = true');
    return parts.length ? parts.join(' AND ') : '1 = 1';
}
/** Sanitize a string value for safe insertion into a ZCQL query string. */
function sanitizeZcqlString(str) {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}
/** Sanitize and validate a date string (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss) for ZCQL queries. */
function sanitizeZcqlDate(dateStr) {
    const cleaned = dateStr.replace(/[^0-9\- :]/g, '');
    return sanitizeZcqlString(cleaned);
}
/** Ensure input is a valid integer or throw a validation error. */
function sanitizeNumber(val) {
    const parsed = Number(val);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric parameter: ${val}`);
    }
    return Math.floor(parsed);
}
//# sourceMappingURL=datastore.js.map