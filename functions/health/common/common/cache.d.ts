export declare function cacheKey(segment: string, scope: string, filterHash: string): string;
/** Stable hash of a filter object for cache keys. */
export declare function hashFilters(filters: Record<string, unknown>): string;
/** Get-or-compute helper implementing cache-aside. */
export declare function cacheAside<T>(cacheInstance: any, key: string, ttl: number, compute: () => Promise<T>): Promise<T>;
