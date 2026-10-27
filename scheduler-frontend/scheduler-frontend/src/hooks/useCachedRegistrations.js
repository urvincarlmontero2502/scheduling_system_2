/**
 * useCachedRegistrations — caching for registration requests data.
 * Caches pending and processed registration lists separately so that
 * switching between tabs doesn't trigger redundant API calls.
 */
import { useEffect, useState, useCallback } from "react";
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

  const fetchPending = useCallback(async () => {
    if (activeTab !== "pending") return;
    const cached = readCache("registrations_pending", CACHE_TTL);
    if (cached && cached.length > 0) {
      setRequests(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
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
        invalidateCache("registrations_pending");
      }
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch registration requests:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchProcessed = useCallback(async () => {
    if (activeTab === "pending") return;
    const cacheKey = `registrations_processed_${activeTab}`;
    const cached = readCache(cacheKey, CACHE_TTL);
    if (cached && cached.length > 0) {
      setRequests(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
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
      // Filter by status
      data = data.filter((r) => r.status === activeTab);
      if (data.length > 0) {
        writeCache(cacheKey, data);
      }
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch processed registrations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPending();
    } else {
      fetchProcessed();
    }

    const handler = () => {
      if (activeTab === "pending") fetchPending();
      else fetchProcessed();
    };
    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("registrationUpdated", handler);
    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("registrationUpdated", handler);
    };
  }, [fetchPending, fetchProcessed]);

  return { requests, loading, refetch: activeTab === "pending" ? fetchPending : fetchProcessed };
}
