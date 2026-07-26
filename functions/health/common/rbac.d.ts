/**
 * Role constants & permission flags.
 * Role codes are immutable strings (CONFIGURATION.md #5).
 * Permission flags are DERIVED from role in code, never from client claims (SECURITY.md).
 *
 * Reference: README.md RBAC table, FRONTEND_ARCHITECTURE.md, BACKEND_ARCHITECTURE.md #4.
 */
export declare const ROLES: readonly ["DEVELOPER", "SUPER_ADMIN", "SCRB_ANALYST", "DISTRICT_COMMAND", "SHO", "IO", "DATA_OPERATOR", "AUDITOR", "VIEWER"];
export type Role = (typeof ROLES)[number];
export declare function isRole(r: unknown): r is Role;
/** Roles that can read full PII (names, caste, religion, age). */
export declare function canSeePii(role: Role, piiRoles: string[]): boolean;
/** Roles that can export / generate reports. */
export declare function canExport(role: Role, exportRoles: string[]): boolean;
/** Roles that can access the admin console. */
export declare function isAdmin(role: Role): boolean;
/** Roles that can read audit logs. */
export declare function canReadAudit(role: Role): boolean;
/** State-wide read (no row filter). */
export declare function isStateScope(role: Role): boolean;
/** Default landing route per role (FRONTEND_ARCHITECTURE.md #3). */
export declare function defaultHome(role: Role): string;
/** Whether a role may access a given route (UI guard; server enforces separately). */
export declare function canAccessRoute(route: string, role: Role): boolean;
