/**
 * useCachedData — shared caching + cross-tab sync for dashboard data.
 * Uses sessionStorage cache (via utils/cache) so switching between
 * Overview / Bookings / Calendar / Resources never wipes loaded data
 * or triggers unnecessary re-fetches.
 *
 * A `storage` event listener ensures that when one tab invalidates the
 * cache, all sibling tabs re-fetch fresh data automatically.
 */
import { useEffect, useState, useCallback } from "react";
import {
  readCache,
  writeCache,
  invalidateCache,
  CACHE_KEYS,
} from "../utils/cache";

const DEFAULT_TTL = 1000 * 60 * 2; // 2 min (matches cache.js default)

/**
 * Generic stale-while-revalidate hook.
 *
 * @param {string} cacheKey        — which CACHE_KEYS entry to use
 * @param {Function} fetcher       — async fn returning { data } (or array)
 * @param {object} options
 * @param {number} options.ttl
 * @param {boolean} options.fetchImmediately  — start fetching on mount (default true)
 * @returns {{ data: T[], loading: boolean, refetch: () => void }}
 */
export function useCachedData(cacheKey, fetcher, { ttl = DEFAULT_TTL, fetchImmediately = true } = {}) {
  const [data, setData] = useState(() => readCache(cacheKey, ttl) || []);
  const [loading, setLoading] = useState(() => {
    const cached = readCache(cacheKey, ttl);
    return !(cached && cached.length > 0);
  });

  const fetchData = useCallback(async () => {
    const cached = readCache(cacheKey, ttl);
    if (cached && cached.length > 0) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetcher();
      const extracted = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];

      if (extracted.length > 0) {
        writeCache(cacheKey, extracted);
      } else {
        invalidateCache(cacheKey);
      }
      setData(extracted);
    } catch (err) {
      // On error, keep cached data if available
      const cached = readCache(cacheKey, ttl);
      if (cached && cached.length > 0) {
        setData(cached);
      } else {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetcher, ttl]);

  // Initial + event-driven fetch
  useEffect(() => {
    if (fetchImmediately) {
      fetchData();
    }

    const handler = () => fetchData();

    // Cross-tab sync: when another tab invalidates cache, re-fetch
    const storageHandler = (e) => {
      if (e.key && e.key.startsWith("scheduler_cache_")) {
        fetchData();
      }
    };

    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("bookingUpdated", handler);
    window.addEventListener("bookingDeleted", handler);
    window.addEventListener("bookingChanged", handler);
    window.addEventListener("storage", storageHandler);

    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("bookingUpdated", handler);
      window.removeEventListener("bookingDeleted", handler);
      window.removeEventListener("bookingChanged", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [fetchData, fetchImmediately]);

  return { data, loading, refetch: fetchData };
}
