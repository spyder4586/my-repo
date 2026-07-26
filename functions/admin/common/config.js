"use strict";
/**
 * Centralized configuration reader for KSP Functions.
 * Reads from environment variables with typed defaults.
 * Reference: CONFIGURATION.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.config = config;
function num(key, def) {
    const v = process.env[key];
    if (v === undefined || v === '')
        return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
function str(key, def) {
    const v = process.env[key];
    return v && v.length > 0 ? v : def;
}
function bool(key, def) {
    const v = process.env[key];
    if (v === undefined)
        return def;
    return v === 'true' || v === '1';
}
function csv(key, def) {
    const v = process.env[key];
    if (!v)
        return def;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
}
function loadConfig() {
    return {
        env: str('APP_ENV', 'development'),
        logLevel: str('LOG_LEVEL', 'info'),
        apiBase: str('NEXT_PUBLIC_API_BASE', 'http://localhost:3000/api/v1'),
        defaultPageSize: num('DEFAULT_PAGE_SIZE', 20),
        maxPageSize: num('MAX_PAGE_SIZE', 100),
        maxDateRangeDays: num('MAX_DATE_RANGE_DAYS', 366),
        cacheTtlKpi: num('CACHE_TTL_SECONDS_KPI', 600),
        cacheTtlMe: num('CACHE_TTL_SECONDS_ME', 300),
        spikeBaselineWeeks: num('SPIKE_BASELINE_WEEKS', 8),
        spikeRatioThreshold: num('SPIKE_RATIO_THRESHOLD', 1.75),
        graphMaxHops: num('GRAPH_MAX_HOPS', 2),
        graphMaxNodes: num('GRAPH_MAX_NODES', 300),
        importMaxBytes: num('IMPORT_MAX_BYTES', 52428800),
        featureRagEnabled: bool('FEATURE_RAG_ENABLED', false),
        smartbrowzEnabled: bool('SMARTBROWZ_ENABLED', true),
        piiRoles: csv('PII_ROLES', [
            'SUPER_ADMIN',
            'SCRB_ANALYST',
            'DISTRICT_COMMAND',
            'SHO',
            'IO',
        ]),
        exportRoles: csv('EXPORT_ROLES', [
            'SUPER_ADMIN',
            'SCRB_ANALYST',
            'DISTRICT_COMMAND',
        ]),
        mfaEnforcedRoles: csv('MFA_ENFORCED_ROLES', ['SUPER_ADMIN', 'SCRB_ANALYST']),
        alertNotifyRoles: csv('ALERT_NOTIFY_ROLES', [
            'SCRB_ANALYST',
            'DISTRICT_COMMAND',
        ]),
        mailFrom: str('MAIL_FROM', ''),
        modelRiskVersion: str('MODEL_RISK_VERSION', 'risk-v1'),
    };
}
let cached = null;
function config() {
    if (!cached)
        cached = loadConfig();
    return cached;
}
//# sourceMappingURL=config.js.map