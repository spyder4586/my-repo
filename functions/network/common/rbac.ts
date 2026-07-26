/**
 * Role constants & permission flags.
 * Role codes are immutable strings (CONFIGURATION.md #5).
 * Permission flags are DERIVED from role in code, never from client claims (SECURITY.md).
 *
 * Reference: README.md RBAC table, FRONTEND_ARCHITECTURE.md, BACKEND_ARCHITECTURE.md #4.
 */

export const ROLES = [
  'DEVELOPER',
  'SUPER_ADMIN',
  'SCRB_ANALYST',
  'DISTRICT_COMMAND',
  'SHO',
  'IO',
  'DATA_OPERATOR',
  'AUDITOR',
  'VIEWER',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(r: unknown): r is Role {
  return typeof r === 'string' && (ROLES as readonly string[]).includes(r);
}

/** Roles that can read full PII (names, caste, religion, age). */
export function canSeePii(role: Role, piiRoles: string[]): boolean {
  if (role === 'DEVELOPER') return true;
  return piiRoles.includes(role);
}

/** Roles that can export / generate reports. */
export function canExport(role: Role, exportRoles: string[]): boolean {
  if (role === 'DEVELOPER') return true;
  return exportRoles.includes(role);
}

/** Roles that can access the admin console. */
export function isAdmin(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'DEVELOPER';
}

/** Roles that can read audit logs. */
export function canReadAudit(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'AUDITOR' || role === 'DEVELOPER';
}

/** State-wide read (no row filter). */
export function isStateScope(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCRB_ANALYST' || role === 'DEVELOPER';
}

/** Default landing route per role (FRONTEND_ARCHITECTURE.md #3). */
export function defaultHome(role: Role): string {
  switch (role) {
    case 'DEVELOPER':
    case 'SUPER_ADMIN':
    case 'SCRB_ANALYST':
      return '/hub';
    case 'DISTRICT_COMMAND':
      return '/district';
    case 'SHO':
    case 'DATA_OPERATOR':
    case 'IO':
      return '/station';
    case 'AUDITOR':
      return '/audit';
    case 'VIEWER':
      return '/hub';
  }
}

/** Whether a role may access a given route (UI guard; server enforces separately). */
export function canAccessRoute(route: string, role: Role): boolean {
  if (role === 'DEVELOPER') return true;
  if (route === '/login' || route === '/' || route === '/forbidden') return true;
  if (route === '/hub')
    return role === 'SUPER_ADMIN' || role === 'SCRB_ANALYST' || role === 'VIEWER';
  if (route === '/district')
    return (
      role === 'DISTRICT_COMMAND' ||
      role === 'SCRB_ANALYST' ||
      role === 'SUPER_ADMIN'
    );
  if (route === '/station')
    return (
      role === 'SHO' ||
      role === 'DATA_OPERATOR' ||
      role === 'IO' ||
      role === 'SCRB_ANALYST' ||
      role === 'SUPER_ADMIN'
    );
  if (route === '/cases') return true;
  if (route === '/network')
    return (
      role === 'SUPER_ADMIN' ||
      role === 'SCRB_ANALYST' ||
      role === 'DISTRICT_COMMAND' ||
      role === 'SHO' ||
      role === 'IO'
    );
  if (route === '/predict')
    return (
      role === 'SUPER_ADMIN' ||
      role === 'SCRB_ANALYST' ||
      role === 'DISTRICT_COMMAND'
    );
  if (route === '/reports') return canExport(role, EXPORT_DEFAULTS);
  if (route === '/admin') return isAdmin(role);
  if (route === '/audit') return canReadAudit(role);
  return false;
}

const EXPORT_DEFAULTS = ['SUPER_ADMIN', 'SCRB_ANALYST', 'DISTRICT_COMMAND'];
