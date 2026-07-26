/**
 * Cache-aside helpers (Catalyst Cache).
 * Reference: BACKEND_ARCHITECTURE.md #5, CATALYST_INTEGRATION.md #7.
 *
 * Key pattern: {env}:{segment}:{scope}:{filterHash}
 */
import { config } from './config';

export function cacheKey(segment: string, scope: string, filterHash: string): string {
  return `${config().env}:${segment}:${scope}:${filterHash}`;
}

/** Stable hash of a filter object for cache keys. */
export function hashFilters(filters: Record<string, unknown>): string {
  const json = JSON.stringify(filters, Object.keys(filters).sort());
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = (h << 5) - h + json.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/** Get-or-compute helper implementing cache-aside. */
export async function cacheAside<T>(
  cacheInstance: any,
  key: string,
  ttl: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (cacheInstance && typeof cacheInstance.get === 'function') {
    try {
      const cached = await cacheInstance.get(key);
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : (cached as T);
      }
    } catch {
      // Cache miss or SDK error; fall through to compute
    }
  }

  const computed = await compute();

  if (cacheInstance && typeof cacheInstance.put === 'function' && computed != null) {
    try {
      const valueToStore = typeof computed === 'object' ? JSON.stringify(computed) : computed;
      await cacheInstance.put(key, valueToStore, ttl);
    } catch {
      // Invalidation or cache storage error non-blocking
    }
  }

  return computed;
}

