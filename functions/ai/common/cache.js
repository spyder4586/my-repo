"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKey = cacheKey;
exports.hashFilters = hashFilters;
exports.cacheAside = cacheAside;
/**
 * Cache-aside helpers (Catalyst Cache).
 * Reference: BACKEND_ARCHITECTURE.md #5, CATALYST_INTEGRATION.md #7.
 *
 * Key pattern: {env}:{segment}:{scope}:{filterHash}
 */
const config_1 = require("./config");
function cacheKey(segment, scope, filterHash) {
    return `${(0, config_1.config)().env}:${segment}:${scope}:${filterHash}`;
}
/** Stable hash of a filter object for cache keys. */
function hashFilters(filters) {
    const json = JSON.stringify(filters, Object.keys(filters).sort());
    let h = 0;
    for (let i = 0; i < json.length; i++) {
        h = (h << 5) - h + json.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h).toString(36);
}
/** Get-or-compute helper implementing cache-aside. */
async function cacheAside(cacheInstance, key, ttl, compute) {
    if (cacheInstance && typeof cacheInstance.get === 'function') {
        try {
            const cached = await cacheInstance.get(key);
            if (cached) {
                return typeof cached === 'string' ? JSON.parse(cached) : cached;
            }
        }
        catch {
            // Cache miss or SDK error; fall through to compute
        }
    }
    const computed = await compute();
    if (cacheInstance && typeof cacheInstance.put === 'function' && computed != null) {
        try {
            const valueToStore = typeof computed === 'object' ? JSON.stringify(computed) : computed;
            await cacheInstance.put(key, valueToStore, ttl);
        }
        catch {
            // Invalidation or cache storage error non-blocking
        }
    }
    return computed;
}
//# sourceMappingURL=cache.js.map