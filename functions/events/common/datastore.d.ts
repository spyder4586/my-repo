/**
 * Data Store access helpers.
 * Reference: BACKEND_ARCHITECTURE.md #3, CATALYST_INTEGRATION.md #4.
 *
 * Thin wrapper over `zcatalyst-sdk-node` Data Store.
 * Real queries land in sub-phase 1A/1D; this exposes the helper shape.
 */
import type { Scope } from './scope';
/** Lazily resolve the Catalyst app (initialized once per invocation). */
export declare function catalyst(req?: unknown): unknown;
/** Build a ZCQL/ORM WHERE clause fragment from a CaseScopeFilter. */
export declare function scopeWhereClause(scope: Scope): string;
/** Sanitize a string value for safe insertion into a ZCQL query string. */
export declare function sanitizeZcqlString(str: string): string;
/** Sanitize and validate a date string (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss) for ZCQL queries. */
export declare function sanitizeZcqlDate(dateStr: string): string;
/** Ensure input is a valid integer or throw a validation error. */
export declare function sanitizeNumber(val: string | number): number;
