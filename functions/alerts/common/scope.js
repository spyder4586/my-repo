"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseScopeFilter = caseScopeFilter;
exports.isVisible = isVisible;
/**
 * Build the row-level scope filter for case queries.
 * Mirrors the switch table in BACKEND_ARCHITECTURE.md #4.
 */
function caseScopeFilter(scope) {
    if (!scope.active)
        return { denyAll: true };
    switch (scope.role) {
        case 'DEVELOPER':
        case 'SUPER_ADMIN':
        case 'SCRB_ANALYST':
            return { state: true };
        case 'DISTRICT_COMMAND':
            if (scope.districtId == null)
                return { denyAll: true };
            return { districtId: scope.districtId };
        case 'SHO':
        case 'DATA_OPERATOR':
            if (scope.unitId == null)
                return { denyAll: true };
            return { unitId: scope.unitId };
        case 'IO':
            if (scope.employeeId == null || scope.unitId == null)
                return { denyAll: true };
            return {
                employeeOrUnit: {
                    employeeId: scope.employeeId,
                    unitId: scope.unitId,
                },
            };
        case 'AUDITOR': {
            const s = scope.auditorScope;
            if (!s || (!s.districtIds?.length && !s.unitIds?.length))
                return { denyAll: true };
            // Auditors are read-only; scope by configured districts/units.
            return { districtId: s.districtIds?.[0], unitId: s.unitIds?.[0] };
        }
        case 'VIEWER':
            return { demoOnly: true };
        default:
            return { denyAll: true };
    }
}
/** Whether a given CaseMaster row is visible under the scope (for in-memory checks). */
function isVisible(scope, row) {
    const f = caseScopeFilter(scope);
    if (f.denyAll)
        return false;
    if (f.state)
        return true;
    if (f.demoOnly)
        return row.isDemo === true;
    if (f.districtId != null && row.districtId !== f.districtId)
        return false;
    if (f.unitId != null && row.policeStationId !== f.unitId)
        return false;
    if (f.employeeOrUnit) {
        const matchEmp = row.policePersonId === f.employeeOrUnit.employeeId;
        const matchUnit = row.policeStationId === f.employeeOrUnit.unitId;
        return matchEmp || matchUnit;
    }
    return true;
}
//# sourceMappingURL=scope.js.map