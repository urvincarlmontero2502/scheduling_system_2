/**
 * useCachedRegistrations — caching for registration requests data.
 * Caches pending and processed registration lists separately so that
 * switching between tabs doesn't trigger redundant API calls.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { readCache, writeCache, invalidateCache } from "../utils/cache";
import * as api from "../api/endpoints";

const CACHE_TTL = 1000 * 60 * 2; // 2 min

export function useCachedRegistrations(activeTab) {
  const [requests, setRequests] = useState(() => {
    const cached = readCache("registrations_pending", CACHE_TTL) || [];
    return activeTab === "pending" && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = readCache("registrations_pending", CACHE_TTL);
    return !(cached && cached.length > 0);
  });

  const fetchPending = useCallback(async (bypassCache = false, silent = false) => {
    if (activeTab !== "pending") return;
    if (!bypassCache) {
      const cached = readCache("registrations_pending", CACHE_TTL);
      if (cached && cached.length > 0) {
        setRequests(cached);
        setLoading(false);
        return;
      }
    }
    // Background refreshes stay silent so the list does not flash a loading state
    if (!silent) setLoading(true);
    try {
      const res = await api.fetchRegistrationRequests();
      let data = res?.data;
      if (Array.isArray(data)) {
        // already array
      } else if (data?.data && Array.isArray(data.data)) {
        data = data.data;
      } else {
        data = [];
      }
      if (data.length > 0) {
        writeCache("registrations_pending", data);
      } else {
        // notify=false: this hook listens for "cacheInvalidated", so notifying would reload it forever
        invalidateCache("registrations_pending", false);
      }
      setRequests((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
    } catch (err) {
      console.error("Failed to fetch registration requests:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchProcessed = useCallback(async (bypassCache = false, silent = false) => {
    if (activeTab === "pending") return;
    const cacheKey = `registrations_processed_${activeTab}`;
    if (!bypassCache) {
      const cached = readCache(cacheKey, CACHE_TTL);
      if (cached && cached.length > 0) {
        setRequests(cached);
        setLoading(false);
        return;
      }
    }
    // Background refreshes stay silent so the list does not flash a loading state
    if (!silent) setLoading(true);
    try {
      const res = await api.fetchProcessedRegistrationRequests();
      let data = res?.data;
      if (Array.isArray(data)) {
        // already array
      } else if (data?.data && Array.isArray(data.data)) {
        data = data.data;
      } else {
        data = [];
      }
      data = data.filter((r) => r.status === activeTab);
      if (data.length > 0) {
        writeCache(cacheKey, data);
      }
      setRequests((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
    } catch (err) {
      console.error("Failed to fetch processed registrations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Keep latest fetchers in refs for interval without triggering re-effects
  const fetchPendingRef = useRef(fetchPending);
  const fetchProcessedRef = useRef(fetchProcessed);
  useEffect(() => {
    fetchPendingRef.current = fetchPending;
    fetchProcessedRef.current = fetchProcessed;
  }, [fetchPending, fetchProcessed]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const refetch = useCallback(() => {
    if (activeTabRef.current === "pending") {
      fetchPendingRef.current(true);
    } else {
      fetchProcessedRef.current(true);
    }
  }, []);

  // Initial load and event listeners
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPending();
    } else {
      fetchProcessed();
    }

    const handler = () => {
      if (activeTab === "pending") fetchPending(true, true);
      else fetchProcessed(true, true);
    };
    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("registrationUpdated", handler);
    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("registrationUpdated", handler);
    };
  }, [activeTab, fetchPending, fetchProcessed]);

  // Smart Polling with visibility listener and useRef
  useEffect(() => {
    const intervalRef = { current: null };

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.hidden) return;
        if (activeTabRef.current === "pending") {
          fetchPendingRef.current(true, true);
        } else {
          fetchProcessedRef.current(true, true);
        }
      }, 12000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { requests, loading, refetch };
}
