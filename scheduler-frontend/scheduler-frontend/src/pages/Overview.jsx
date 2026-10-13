import { useState, useEffect } from "react";
import { isSpecialEvent } from "../utils/specialEvents";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  readCache,
  writeCache,
  invalidateCache,
  CACHE_KEYS,
} from "../utils/cache";
import { Building2, Car, Search, Filter, Calendar, Wrench } from "lucide-react";
import * as api from "../api/endpoints";
import FacilityBookingModal from "../components/FacilityBookingModal";
import VehicleBookingModal from "../components/VehicleBookingModal";
import { SkeletonStatCard, SkeletonResourceCard } from "../components/Skeleton";

/** Status badge configuration */
const STATUS_VARIANTS = {
  available: {
    label: "Available",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  booked: {
    label: "In Use",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  maintenance: {
    label: "🟡 Maintenance",
    className: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
};

/** Resolve the display status of a resource */
function getResourceStatus(item) {
  if (item.is_maintenance || item.status === "maintenance") return "maintenance";
  if (item.available === false || item.status === "booked") return "booked";
  return "available";
}

/** Format capacity with "pax" suffix, avoiding duplication */
function formatCapacity(cap) {
  if (!cap) return "N/A";
  if (/\bpax$/i.test(cap)) return cap;
  return `${cap} pax`;
}

export default function Overview() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [resources, setResources] = useState(() => {
    const cached = readCache(CACHE_KEYS.RESOURCES);
    return cached && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = readCache(CACHE_KEYS.RESOURCES);
    return !(cached && cached.length > 0);
  });

  const [apiStatus, setApiStatus] = useState(() => {
    const cached = readCache(CACHE_KEYS.HEALTH);
    return cached?.api ?? null;
  });
  const [dbStatus, setDbStatus] = useState(() => {
    const cached = readCache(CACHE_KEYS.HEALTH);
    return cached?.database ?? null;
  });

  const [selectedResource, setSelectedResource] = useState(null);
  const [mainFilter, setMainFilter] = useState("all");
  const [vehicleSubFilter, setVehicleSubFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  // Compute booking stats from bookings array (pure function)
  const computeStats = (bookings) => {
    const requests = (bookings || []).filter((b) => !isSpecialEvent(b));
    const pendingCount = requests.filter(
      (b) => b?.status?.toLowerCase() === "pending",
    ).length;
    const approvedCount = requests.filter(
      (b) => b?.status?.toLowerCase() === "approved",
    ).length;
    return { pending: pendingCount, approved: approvedCount };
  };

  // Stale-while-revalidate: render cached data instantly, then background-fetch
  useEffect(() => {
    let isMounted = true;

    // If cached data exists, populate state immediately (0ms render)
    const cachedResources = readCache(CACHE_KEYS.RESOURCES);
    const cachedBookings = readCache(CACHE_KEYS.BOOKINGS);
    if (cachedResources && cachedResources.length > 0) {
      const cachedStats = computeStats(cachedBookings || []);
      setStats(cachedStats);
      setResources(cachedResources);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Background health check (parallel with data fetch)
    api.checkHealth?.()
      .then((res) => {
        if (!isMounted) return;
        const healthData = res.data || {};
        setApiStatus(healthData?.api ?? true);
        setDbStatus(healthData?.database ?? true);
        writeCache(CACHE_KEYS.HEALTH, healthData);
      })
      .catch(() => {
        if (!isMounted) return;
        setApiStatus(false);
        setDbStatus(false);
      });

    // Background: fetch fresh data in parallel (no waterfall)
    Promise.all([
      api.fetchBookings?.().catch((err) => {
        if (isMounted) toast.error("Unable to load bookings");
        return { data: [] };
      }),
      api.fetchResources?.().catch((err) => {
        if (isMounted) toast.error("Unable to load resources");
        return { data: [] };
      }),
    ])
      .then(([bookingsRes, resourcesRes]) => {
        if (!isMounted) return;

        const bookings = Array.isArray(bookingsRes?.data)
          ? bookingsRes.data
          : Array.isArray(bookingsRes?.data?.data)
            ? bookingsRes.data.data
            : Array.isArray(bookingsRes)
              ? bookingsRes
              : [];
        const fetchedResources =
          Array.isArray(resourcesRes?.data)
            ? resourcesRes.data
            : Array.isArray(resourcesRes?.data?.data)
              ? resourcesRes.data.data
              : [];

        // Update cache (only if non-empty to avoid stale empty-array lock-in)
        if (bookings.length > 0) writeCache(CACHE_KEYS.BOOKINGS, bookings);
        if (fetchedResources.length > 0) writeCache(CACHE_KEYS.RESOURCES, fetchedResources);

        // Update state
        setStats(computeStats(bookings));
        setResources(fetchedResources);
      })
      .catch(() => {
        // Keep cached data on error
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for cache invalidation events (broadcast by other pages)
  useEffect(() => {
    const handler = () => {
      const cachedResources = readCache(CACHE_KEYS.RESOURCES);
      if (cachedResources) setResources(cachedResources);
      const cachedBookings = readCache(CACHE_KEYS.BOOKINGS);
      if (cachedBookings) setStats(computeStats(cachedBookings));
    };
    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("bookingUpdated", handler);
    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("bookingUpdated", handler);
    };
  }, []);

  const handleOpenBooking = (resource) => {
    const status = getResourceStatus(resource);
    if (status === "maintenance") return;
    setSelectedResource(resource);
  };

  const handleBookingSubmit = (payload) => {
    const apiPayload = {
      resource_id: payload.item_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      purpose: payload.purpose,
      full_name: payload.full_name || null,
      cell_number: payload.cell_number,
      address: payload.address || null,
    };

    // --- Optimistic update: close modal + show success immediately ---
    const optimisticBooking = {
      id: `optimistic-${Date.now()}`,
      resource_id: payload.item_id,
      resource: payload.resourceName || "",
      full_name: payload.full_name || null,
      purpose: payload.purpose,
      start_date: payload.start_date,
      end_date: payload.end_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      status: "pending",
    };

    // Optimistically add to cached bookings + update stats
    const cachedBookings = readCache(CACHE_KEYS.BOOKINGS) || [];
    const updatedBookings = [optimisticBooking, ...cachedBookings];
    writeCache(CACHE_KEYS.BOOKINGS, updatedBookings);

    // Optimistically update stats
    const prevStats = { ...stats };
    setStats((prev) => ({ pending: prev.pending + 1, approved: prev.approved }));

    // Optimistically update resource availability if direct use
    if (payload.status === "approved") {
      const cachedResources = readCache(CACHE_KEYS.RESOURCES) || [];
      const updatedResources = cachedResources.map((r) =>
        String(r.resource_id || r.id) === String(payload.item_id)
          ? { ...r, available: false, status: "booked" }
          : r,
      );
      writeCache(CACHE_KEYS.RESOURCES, updatedResources);
      setResources(updatedResources);
    }

    // Close modal + show toast immediately (before server response)
    setSelectedResource(null);
    toast.success("Booking request submitted successfully!");

    // Broadcast cache update to other tabs
    window.dispatchEvent(new Event("bookingUpdated"));

    // --- Background: fire API request ---
    return api
      .createBooking(apiPayload)
      .then((res) => {
        // Sync with server payload if available
        if (res?.data) {
          const serverBooking = res.data.booking || res.data;
          const serverBookings = updatedBookings.map((b) =>
            b.id === optimisticBooking.id ? serverBooking : b,
          );
          writeCache(CACHE_KEYS.BOOKINGS, serverBookings);
          invalidateCache(CACHE_KEYS.HEALTH);
        }
      })
      .catch((err) => {
        // --- Rollback on failure ---
        // Restore previous stats
        setStats(prevStats);

        // Remove optimistic booking from cache
        const currentBookings = readCache(CACHE_KEYS.BOOKINGS) || [];
        const rolledBack = currentBookings.filter(
          (b) => b.id !== optimisticBooking.id,
        );
        writeCache(CACHE_KEYS.BOOKINGS, rolledBack);

        // Restore resource availability
        if (payload.status === "approved") {
          const currentResources = readCache(CACHE_KEYS.RESOURCES) || [];
          const restored = currentResources.map((r) =>
            String(r.resource_id || r.id) === String(payload.item_id)
              ? { ...r, available: true, status: "available" }
              : r,
          );
          writeCache(CACHE_KEYS.RESOURCES, restored);
          setResources(restored);
        }

        window.dispatchEvent(new Event("bookingUpdated"));

        const errorMsg =
          err?.response?.data?.message ||
          err?.response?.data?.conflict_message ||
          "Failed to submit booking request. Please try again.";

        toast.error(errorMsg);

        // If the error is a 409 conflict, re-open the modal
        if (err?.response?.status === 409 || err?.response?.status === 422) {
          setSelectedResource(payload._originalResource || null);
        }

        throw err;
      });
  };

  const allFacilities = resources.filter(
    (r) => r?.type?.toLowerCase() === "facility",
  );
  const allVehicles = resources.filter(
    (r) => r?.type?.toLowerCase() === "vehicle",
  );

  const applyFilters = (items) => {
    return items.filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (item?.name || "").toLowerCase();
        const description = (item?.description || "").toLowerCase();
        if (!name.includes(query) && !description.includes(query)) return false;
      }
      if (availabilityFilter === "available") {
        if (item?.available !== true && item?.status !== "available")
          return false;
      } else if (availabilityFilter === "booked") {
        if (item?.available !== false && item?.status !== "booked")
          return false;
      }
      return true;
    });
  };

  const facilities = applyFilters(allFacilities);
  const vehicles = applyFilters(allVehicles);

  const getVehicleCategory = (name = "") => {
    const lower = name.toLowerCase();
    if (
      lower.includes("dumptruck") ||
      lower.includes("backhole") ||
      lower.includes("backhoe") ||
      lower.includes("payloader") ||
      lower.includes("bulldozer") ||
      lower.includes("road roller") ||
      lower.includes("grader") ||
      lower.includes("self load") ||
      lower.includes("cargo truck") ||
      lower.includes("man lift")
    ) {
      return "heavy";
    }
    if (lower.includes("ambul") || lower.includes("abul")) {
      return "ambulance";
    }
    return "service";
  };

  const heavyEquipment = vehicles.filter(
    (v) => getVehicleCategory(v.name) === "heavy",
  );
  const ambulances = vehicles.filter(
    (v) => getVehicleCategory(v.name) === "ambulance",
  );
  const serviceVehicles = vehicles.filter(
    (v) => getVehicleCategory(v.name) === "service",
  );

  const filteredVehicles = vehicles.filter((v) => {
    if (vehicleSubFilter === "all") return true;
    return getVehicleCategory(v.name) === vehicleSubFilter;
  });

  const availableFacilities = allFacilities.filter(
    (f) => f?.available === true || f?.status === "available",
  );
  const availableVehicles = allVehicles.filter(
    (v) => v?.available === true || v?.status === "available",
  );

  const STATS_ITEMS = [
    {
      label: "Pending requests",
      value: stats.pending ?? 0,
      tone: "text-status-pending",
    },
    {
      label: "Approved this week",
      value: stats.approved ?? 0,
      tone: "text-status-approved",
    },
    {
      label: "Facilities",
      value: `${availableFacilities.length}/${allFacilities.length}`,
      subLabel: "available/total",
      tone: "text-ink",
    },
    {
      label: "Vehicles",
      value: `${availableVehicles.length}/${allVehicles.length}`,
      subLabel: "available/total",
      tone: "text-ink",
    },
  ];

  const resourceType = selectedResource?.type?.toLowerCase();

  return (
    <div>
      <header className="flex flex-col gap-3 border-b border-line bg-white px-4 sm:px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[17px] font-semibold">
            Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-[13px] text-steel">
            Here's what's happening with facility and vehicle bookings. Click
            any resource below to make a request.
          </p>
        </div>

        {/* API & DB Status Indicators + Notification Bell */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-medium text-steel">
            <span className="relative flex h-2.5 w-2.5">
              {apiStatus === null ? (
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
              ) : apiStatus ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </span>
            <span>
              {apiStatus === null
                ? "Checking API..."
                : apiStatus
                  ? "API Connected"
                  : "API Offline"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-medium text-steel">
            <span className="relative flex h-2.5 w-2.5">
              {dbStatus === null ? (
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
              ) : dbStatus ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </span>
            <span>
              {dbStatus === null
                ? "Checking DB..."
                : dbStatus
                  ? "Database Connected"
                  : "Database Error"}
            </span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={`stat-skeleton-${i}`} />
            ))
          : STATS_ITEMS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-line bg-white p-4 shadow-sm"
              >
                <p className={`font-mono text-[28px] font-semibold ${stat.tone}`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-[13px] text-steel">{stat.label}{stat.subLabel ? ` ${stat.subLabel}` : ""}</p>
              </div>
            ))}
      </div>

      {/* Main Content Area */}
      <div className="px-4 sm:px-6 pb-6 space-y-6">
        {/* Filter Navigation Block */}
        <div className="border-b border-line pb-4 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
            <button
              onClick={() => {
                setMainFilter("all");
                setVehicleSubFilter("all");
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "all"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}
            >
              All Resources ({resources.length})
            </button>
            <button
              onClick={() => setMainFilter("facility")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "facility"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}
            >
              Facilities ({facilities.length})
            </button>
            <button
              onClick={() => setMainFilter("vehicle")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "vehicle"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}
            >
              Vehicles ({vehicles.length})
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-line pl-7 pr-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-steel" />
              <span className="text-[12px] text-steel">Show:</span>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="rounded-md border border-line bg-white px-2 py-1 text-[12px] outline-none focus:border-brand"
              >
                <option value="all">All Status</option>
                <option value="available">Available Only</option>
                <option value="booked">Booked Only</option>
              </select>
            </div>
          </div>
          {(searchQuery || availabilityFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setAvailabilityFilter("all");
              }}
              className="mt-1 text-[12px] text-brand hover:underline"
            >
              Clear filters
            </button>
          )}
          {mainFilter === "vehicle" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              <span className="text-[12px] text-steel mr-1 font-medium">
                Vehicle Type:
              </span>
              <button
                onClick={() => setVehicleSubFilter("all")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                  vehicleSubFilter === "all"
                    ? "bg-ink text-white"
                    : "bg-paper border border-line text-steel hover:bg-gray-100"
                }`}
              >
                All ({vehicles.length})
              </button>
              <button
                onClick={() => setVehicleSubFilter("heavy")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                  vehicleSubFilter === "heavy"
                    ? "bg-ink text-white"
                    : "bg-paper border border-line text-steel hover:bg-gray-100"
                }`}
              >
                Heavy Equipment ({heavyEquipment.length})
              </button>
              <button
                onClick={() => setVehicleSubFilter("ambulance")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                  vehicleSubFilter === "ambulance"
                    ? "bg-ink text-white"
                    : "bg-paper border border-line text-steel hover:bg-gray-100"
                }`}
              >
                Ambulances ({ambulances.length})
              </button>
              <button
                onClick={() => setVehicleSubFilter("service")}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                  vehicleSubFilter === "service"
                    ? "bg-ink text-white"
                    : "bg-paper border border-line text-steel hover:bg-gray-100"
                }`}
              >
                Service Vehicles ({serviceVehicles.length})
              </button>
            </div>
          )}
        </div>

        {/* Facilities Section */}
        {(mainFilter === "all" || mainFilter === "facility") && (
          <div>
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-3">
              <Building2 size={18} className="text-brand" /> Facilities Overview
              ({facilities.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonResourceCard key={`facility-skeleton-${i}`} />
                ))}
              </div>
            ) : facilities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[13px] text-steel">
                {searchQuery || availabilityFilter !== "all"
                  ? "No facilities match your current filters. Try adjusting your search."
                  : "No facilities found."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {facilities.map((item) => {
                  const status = getResourceStatus(item);
                  const isMaintenance = status === "maintenance";
                  return (
                    <div
                      key={item.resource_id || item.id}
                      onClick={() => handleOpenBooking(item)}
                      className="group flex flex-col h-full overflow-hidden rounded-xl border border-line bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="relative h-20 sm:h-36 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line">
                        {item.image && item.image.trim() !== "" ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-steel gap-1">
                            <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-100">
                              <Building2 size={24} className="text-blue-400" />
                            </div>
                            <span className="text-[10px]">No image provided</span>
                          </div>
                        )}
                        <span
                          className={`absolute top-1.5 right-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium border ${
                            isMaintenance
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : item.available
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isMaintenance
                            ? "Maintenance"
                            : item.available
                              ? "Available"
                              : "In Use"}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 p-2.5">
                        <h3 className="text-[13px] font-semibold text-ink line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-steel">
                          Capacity:{" "}
                          <span className="font-medium text-ink">
                            {formatCapacity(item.capacity)}
                          </span>
                        </p>
                        <p className="mt-1 text-[10px] text-steel line-clamp-2">
                          {item.description || "No description provided."}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMaintenance) return;
                            handleOpenBooking(item);
                          }}
                          disabled={isMaintenance}
                          className={`mt-auto w-full rounded-lg px-2 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 transition ${
                            isMaintenance
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-80 border-none shadow-none"
                              : "bg-brand text-white hover:opacity-90"
                          }`}
                        >
                          {isMaintenance ? (
                            <>
                              <Wrench size={12} /> Under Maintenance
                            </>
                          ) : (
                            <>
                              <Calendar size={12} /> Request
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Vehicles Section */}
        {(mainFilter === "all" || mainFilter === "vehicle") && (
          <div>
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-3">
              <Car size={18} className="text-brand" /> Vehicles Overview (
              {filteredVehicles.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonResourceCard key={`vehicle-skeleton-${i}`} />
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[13px] text-steel">
                {searchQuery || availabilityFilter !== "all"
                  ? "No vehicles match your current filters. Try adjusting your search."
                  : "No vehicles found in this category."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {filteredVehicles.map((item) => {
                  const status = getResourceStatus(item);
                  const isMaintenance = status === "maintenance";
                  return (
                    <div
                      key={item.resource_id || item.id}
                      onClick={() => handleOpenBooking(item)}
                      className="group flex flex-col h-full overflow-hidden rounded-xl border border-line bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="relative h-20 sm:h-36 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line">
                        {item.image && item.image.trim() !== "" ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-steel gap-1">
                            <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100">
                              <Car size={24} className="text-amber-400" />
                            </div>
                            <span className="text-[10px]">No image provided</span>
                          </div>
                        )}
                        <span
                          className={`absolute top-1.5 right-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium border ${
                            isMaintenance
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : item.available
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isMaintenance
                            ? "Maintenance"
                            : item.available
                              ? "Available"
                              : "In Use"}
                        </span>
                      </div>
                      <div className="flex flex-col flex-1 p-2.5">
                        <h3 className="text-[13px] font-semibold text-ink line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-steel">
                          Unit Details:{" "}
                          <span className="font-medium text-ink">
                            {item.unit_name || item.capacity
                              ? `${item.unit_name || item.capacity}`
                              : "N/A"}
                          </span>
                        </p>
                        <p className="mt-1 text-[10px] text-steel line-clamp-2">
                          {item.description || "No description provided."}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMaintenance) return;
                            handleOpenBooking(item);
                          }}
                          disabled={isMaintenance}
                          className={`mt-auto w-full rounded-lg px-2 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 transition ${
                            isMaintenance
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-80 border-none shadow-none"
                              : "bg-brand text-white hover:opacity-90"
                          }`}
                        >
                          {isMaintenance ? (
                            <>
                              <Wrench size={12} /> Under Maintenance
                            </>
                          ) : (
                            <>
                              <Calendar size={12} /> Request
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <FacilityBookingModal
        isOpen={!!selectedResource && resourceType === "facility"}
        onClose={() => setSelectedResource(null)}
        onSubmit={(payload) =>
          handleBookingSubmit({
            ...payload,
            _originalResource: selectedResource,
            resourceName: selectedResource?.name,
          })
        }
        selectedFacility={selectedResource}
      />

      <VehicleBookingModal
        isOpen={!!selectedResource && resourceType === "vehicle"}
        onClose={() => setSelectedResource(null)}
        onSubmit={(payload) =>
          handleBookingSubmit({
            ...payload,
            _originalResource: selectedResource,
            resourceName: selectedResource?.name,
          })
        }
        selectedVehicle={selectedResource}
      />
    </div>
  );
}
