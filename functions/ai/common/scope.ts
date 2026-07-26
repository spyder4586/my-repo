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
  auditorScope?: { districtIds?: number[]; unitIds?: number[] };
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
  employeeOrUnit?: { employeeId: number; unitId: number };
  demoOnly?: boolean;
  /** true when the scope matches nothing (deny-by-default). */
  denyAll?: boolean;
}

/**
 * Build the row-level scope filter for case queries.
 * Mirrors the switch table in BACKEND_ARCHITECTURE.md #4.
 */
export function caseScopeFilter(scope: Scope): CaseScopeFilter {
  if (!scope.active) return { denyAll: true };
  switch (scope.role) {
    case 'DEVELOPER':
    case 'SUPER_ADMIN':
    case 'SCRB_ANALYST':
      return { state: true };
    case 'DISTRICT_COMMAND':
      if (scope.districtId == null) return { denyAll: true };
      return { districtId: scope.districtId };
    case 'SHO':
    case 'DATA_OPERATOR':
      if (scope.unitId == null) return { denyAll: true };
      return { unitId: scope.unitId };
    case 'IO':
      if (scope.employeeId == null || scope.unitId == null) return { denyAll: true };
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
export function isVisible(
  scope: Scope,
  row: { districtId?: number; policeStationId?: number; policePersonId?: number; isDemo?: boolean },
): boolean {
  const f = caseScopeFilter(scope);
  if (f.denyAll) return false;
  if (f.state) return true;
  if (f.demoOnly) return row.isDemo === true;
  if (f.districtId != null && row.districtId !== f.districtId) return false;
  if (f.unitId != null && row.policeStationId !== f.unitId) return false;
  if (f.employeeOrUnit) {
    const matchEmp = row.policePersonId === f.employeeOrUnit.employeeId;
    const matchUnit = row.policeStationId === f.employeeOrUnit.unitId;
    return matchEmp || matchUnit;
  }
  return true;
}
