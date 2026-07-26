/**
 * Centralized configuration reader for KSP Functions.
 * Reads from environment variables with typed defaults.
 * Reference: CONFIGURATION.md
 */
export type AppEnv = 'development' | 'staging' | 'production';
export type LogLevel = 'info' | 'debug';
export interface AppConfig {
    env: AppEnv;
    logLevel: LogLevel;
    apiBase: string;
    defaultPageSize: number;
    maxPageSize: number;
    maxDateRangeDays: number;
    cacheTtlKpi: number;
    cacheTtlMe: number;
    spikeBaselineWeeks: number;
    spikeRatioThreshold: number;
    graphMaxHops: number;
    graphMaxNodes: number;
    importMaxBytes: number;
    featureRagEnabled: boolean;
    smartbrowzEnabled: boolean;
    piiRoles: string[];
    exportRoles: string[];
    mfaEnforcedRoles: string[];
    alertNotifyRoles: string[];
    mailFrom: string;
    modelRiskVersion: string;
}
export declare function loadConfig(): AppConfig;
export declare function config(): AppConfig;
