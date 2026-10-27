/**
 * Client-side caching utility with TTL (stale-while-revalidate pattern).
 * Uses sessionStorage so caches are isolated per browser tab/session.
 */

const CACHE_PREFIX = "scheduler_cache_";
const DEFAULT_TTL = 1000 * 60 * 2; // 2 minutes

/**
 * Read a cached value if it exists and hasn't expired.
 * @param {string} key - Cache key
 * @param {number} ttl - Time-to-live in milliseconds
 * @returns {*} Cached value or null if expired/missing
 */
export function readCache(key, ttl = DEFAULT_TTL) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > ttl) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Write a value to the cache with a timestamp.
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
export function writeCache(key, data) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {
    // Storage quota exceeded or unavailable — silently fail
  }
}

/**
 * Remove a specific cache entry (cache invalidation).
 * @param {string} key - Cache key
 */
export function invalidateCache(key) {
  try {
    sessionStorage.removeItem(CACHE_PREFIX + key);
    // Dispatch event for cross-component/tab sync
    window.dispatchEvent(new Event("cacheInvalidated"));
  } catch {}
}

/**
 * Invalidate multiple cache entries at once.
 * @param {string[]} keys - Cache keys
 */
export function invalidateCacheMany(keys) {
  keys.forEach(invalidateCache);
}

/**
 * Clear all scheduler cache entries.
 */
export function clearAllCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

/**
 * Stale-while-revalidate: return cached data immediately, then fetch fresh data.
 * @param {string} cacheKey - Cache key
 * @param {Function} fetcher - Async function that returns fresh data
 * @param {Function} onResolved - Callback when fresh data arrives
 * @param {number} ttl - Cache TTL in ms
 * @returns {Promise<*>} Always resolves with fresh data; caller can use
 *   readCache(cacheKey) for the immediate cached value.
 */
export async function swr(cacheKey, fetcher, onResolved, ttl = DEFAULT_TTL) {
  const cached = readCache(cacheKey, ttl);
  if (cached !== null && typeof onResolved !== "function") {
    // Caller reads cache separately; just fetch in background
  }

  try {
    const fresh = await fetcher();
    writeCache(cacheKey, fresh);
    if (typeof onResolved === "function") onResolved(fresh);
    return fresh;
  } catch (err) {
    // Return cached data as fallback on error
    return cached;
  }
}

/**
 * Cache keys used across the app.
 */
export const CACHE_KEYS = {
  RESOURCES: "resources",
  BOOKINGS: "bookings",
  USER: "user",
  HEALTH: "health",
  REGISTRATIONS_PENDING: "registrations_pending",
  REGISTRATIONS_PROCESSED: "registrations_processed",
};
