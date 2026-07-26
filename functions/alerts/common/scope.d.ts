/**
 * Scope filter logic for data-scoped queries.
 * Reference: BACKEND_ARCHITECTURE.md #4, SECURITY.md, ADR-012.
 *
 * The output is a logical filter predicate applied at the Data Store layer.
 * Deny-by-default: unknown/inactive roles produce a filter that matches nothing.
 */
import type { Role } from './rbac';
export interface Scope {
    role: Role;
    districtId?: number | null;
    unitId?: number | null;
    employeeId?: number | null;
    auditorScope?: {
        districtIds?: number[];
        unitIds?: number[];
    };
    active: boolean;
}
/** A normalized filter applied to CaseMaster-equivalent queries. */
export interface CaseScopeFilter {
    /** empty object = state-wide (no filter) */
    state?: boolean;
    districtId?: number;
    unitId?: number;
    employeeId?: number;
    /** OR branch for IO (assigned cases OR own unit). */
    employeeOrUnit?: {
        employeeId: number;
        unitId: number;
    };
    demoOnly?: boolean;
    /** true when the scope matches nothing (deny-by-default). */
    denyAll?: boolean;
}
/**
 * Build the row-level scope filter for case queries.
 * Mirrors the switch table in BACKEND_ARCHITECTURE.md #4.
 */
export declare function caseScopeFilter(scope: Scope): CaseScopeFilter;
/** Whether a given CaseMaster row is visible under the scope (for in-memory checks). */
export declare function isVisible(scope: Scope, row: {
    districtId?: number;
    policeStationId?: number;
    policePersonId?: number;
    isDemo?: boolean;
}): boolean;
