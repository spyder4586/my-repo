/**
 * Data Store access helpers.
 * Reference: BACKEND_ARCHITECTURE.md #3, CATALYST_INTEGRATION.md #4.
 *
 * Thin wrapper over `zcatalyst-sdk-node` Data Store.
 * Real queries land in sub-phase 1A/1D; this exposes the helper shape.
 */
import type { Scope } from './scope';
import { caseScopeFilter } from './scope';

/** Lazily resolve the Catalyst app (initialized once per invocation). */
export function catalyst(req?: unknown): unknown {
  try {
    // Dynamic require so local Vitest test environment does not hard fail without SDK
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdk = require('zcatalyst-sdk-node');
    return sdk.initialize(req);
  } catch {
    throw new Error('Catalyst SDK not initialized or zcatalyst-sdk-node package not loaded.');
  }
}

/** Build a ZCQL/ORM WHERE clause fragment from a CaseScopeFilter. */
export function scopeWhereClause(scope: Scope): string {
  const f = caseScopeFilter(scope);
  if (f.denyAll) return '1 = 0';
  if (f.state) return '1 = 1';
  const parts: string[] = [];
  if (f.districtId != null) parts.push(`DistrictID = ${f.districtId}`);
  if (f.unitId != null) parts.push(`PoliceStationID = ${f.unitId}`);
  if (f.employeeOrUnit) {
    parts.push(
      `(PolicePersonID = ${f.employeeOrUnit.employeeId} OR PoliceStationID = ${f.employeeOrUnit.unitId})`,
    );
  }
  if (f.demoOnly) parts.push('IsDemo = true');
  return parts.length ? parts.join(' AND ') : '1 = 1';
}

/** Sanitize a string value for safe insertion into a ZCQL query string. */
export function sanitizeZcqlString(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

/** Sanitize and validate a date string (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss) for ZCQL queries. */
export function sanitizeZcqlDate(dateStr: string): string {
  const cleaned = dateStr.replace(/[^0-9\- :]/g, '');
  return sanitizeZcqlString(cleaned);
}

/** Ensure input is a valid integer or throw a validation error. */
export function sanitizeNumber(val: string | number): number {
  const parsed = Number(val);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric parameter: ${val}`);
  }
  return Math.floor(parsed);
}

