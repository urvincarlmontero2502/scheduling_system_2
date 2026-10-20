import { useState, useEffect } from "react";
import { isSpecialEvent } from "../utils/specialEvents";
import { useAuth } from "../context/AuthContext";
import { Search, Building2, Car, Image as ImageIcon, Users as UserGroupIcon, Clock, CheckCircle, Building, Truck } from "lucide-react";
import * as api from "../api/endpoints";
import FacilityBookingModal from "../components/FacilityBookingModal";
import VehicleBookingModal from "../components/VehicleBookingModal";
import NotificationBell from "../components/NotificationBell";
import { useNotifications } from "../context/NotificationContext";

export default function Overview() {
  const { user } = useAuth();
  const { toggleDropdown, bellRef } = useNotifications();
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedResource, setSelectedResource] = useState(null);
  const [mainFilter, setMainFilter] = useState("all"); // "all" | "facility" | "vehicle"
  const [vehicleSubFilter, setVehicleSubFilter] = useState("all"); // "all" | "heavy" | "ambulance" | "service"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "available" | "maintenance"

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.fetchBookings?.().catch(() => ({ data: [] })),
      api.fetchResources?.().catch(() => ({ data: [] })),
    ])
      .then(([bookingsRes, resourcesRes]) => {
        if (!isMounted) return;

        const bookings = Array.isArray(bookingsRes?.data)
          ? bookingsRes.data
          : Array.isArray(bookingsRes)
            ? bookingsRes
            : [];

        // Yearly special events are not requests
        const requests = bookings.filter((b) => !isSpecialEvent(b));

        const pendingCount = requests.filter(
          (b) => b?.status?.toLowerCase() === "pending",
        ).length;

        const approvedCount = requests.filter(
          (b) => b?.status?.toLowerCase() === "approved",
        ).length;

        setStats({
          pending: pendingCount,
          approved: approvedCount,
        });

        setResources(
          Array.isArray(resourcesRes?.data) ? resourcesRes.data : [],
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenBooking = (resource) => {
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

    return api
      .createBooking(apiPayload)
      .then(() => {
        alert("Booking request submitted successfully!");
        setSelectedResource(null);
      })
      .catch((err) => {
        console.error("Failed to submit booking request", err);
        alert(
          err?.response?.data?.message || "Failed to submit booking request.",
        );
      });
  };

  const allFacilities = resources.filter(
    (r) => r?.type?.toLowerCase() === "facility",
  );
  const allVehicles = resources.filter(
    (r) => r?.type?.toLowerCase() === "vehicle",
  );

  // Apply search filter
  const applyFilters = (items) => {
    return items.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (item?.name || "").toLowerCase();
        const description = (item?.description || "").toLowerCase();
        if (!name.includes(query) && !description.includes(query)) return false;
      }
      return true;
    });
  };

  const facilities = applyFilters(allFacilities);
  const vehicles = applyFilters(allVehicles);

  // Helper function to categorize vehicles based on their names (with typo handling for 'abulance')
  const getVehicleCategory = (name = "") => {
    const lower = name.toLowerCase();
    if (
      lower.includes("dumptruck") ||
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

  // Filtered vehicles based on sub-category selection
  const filteredVehicles = vehicles.filter((v) => {
    if (vehicleSubFilter === "all") return true;
    return getVehicleCategory(v.name) === vehicleSubFilter;
  });

  // Available resources (for stats display)
  const availableFacilities = allFacilities.filter(
    (f) => f?.available === true || f?.status === "available",
  );
  const availableVehicles = allVehicles.filter(
    (v) => v?.available === true || v?.status === "available",
  );

  const STATS_ITEMS = [
    {
      label: "Pending requests",
      value: loading ? "..." : (stats.pending ?? 0),
      icon: Clock,
    },
    {
      label: "Approved this week",
      value: loading ? "..." : (stats.approved ?? 0),
      icon: CheckCircle,
    },
    {
      label: "Facilities",
      value: loading
        ? "..."
        : `${availableFacilities.length}/${allFacilities.length}`,
      subLabel: "(available/total)",
      icon: Building,
    },
    {
      label: "Vehicles",
      value: loading
        ? "..."
        : `${availableVehicles.length}/${allVehicles.length}`,
      subLabel: "(available/total)",
      icon: Truck,
    },
  ];

  const resourceType = selectedResource?.type?.toLowerCase();

  return (
    <div className="p-4 md:p-6 w-full max-w-full">
      {/* Top Bar: Notification Bell right, hidden on mobile */}
      <div className="flex items-center justify-end sm:justify-between">
        <div className="hidden sm:ml-auto sm:flex">
          <NotificationBell ref={bellRef} onClick={toggleDropdown} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        {STATS_ITEMS.map((stat) => (
          <div
            key={stat.label}
            className={`relative p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs ${loading ? "animate-pulse" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-3xl font-bold text-slate-900">
                {loading ? (
                  <span className="inline-block h-8 w-14 bg-slate-200 rounded-md"></span>
                ) : (
                  stat.value
                )}
              </p>
              {stat.icon && (
                <stat.icon size={20} className="text-slate-300 opacity-50" />
              )}
            </div>
            <p className="mt-1 text-xs uppercase tracking-wider font-semibold text-slate-500">
              {stat.label}
              {stat.subLabel ? ` ${stat.subLabel}` : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 pb-8 sm:pb-12">
        {/* Filter & Search Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Left: Category Pills */}
          <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar whitespace-nowrap w-full sm:w-auto">
            <button
              onClick={() => {
                setMainFilter("all");
                setVehicleSubFilter("all");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                mainFilter === "all"
                  ? "bg-emerald-700 text-white shadow-sm border-emerald-700"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              }`}
            >
              All Resources ({resources.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("facility");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                mainFilter === "facility"
                  ? "bg-emerald-700 text-white shadow-sm border-emerald-700"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              }`}
            >
              Facilities ({facilities.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("vehicle");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                mainFilter === "vehicle"
                  ? "bg-emerald-700 text-white shadow-sm border-emerald-700"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              }`}
            >
              Vehicles ({vehicles.length})
            </button>
          </div>

          {/* Right: Search Input + Status Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto flex items-center">
              <Search
                size={14}
                className="absolute left-3 top-[52%] -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4"
              />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm py-2 pl-10 pr-3 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="all">Show: All Status</option>
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

                {/* Facilities Section (Shown if mainFilter is 'all' or 'facility') */}
        {(mainFilter === "all" || mainFilter === "facility") && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <Building2 size={18} className="text-emerald-700" /> Facilities Overview
              ({facilities.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
                    <div className="w-full h-28 sm:h-32 bg-slate-200/70 relative">
                      <div className="w-14 h-4 rounded-full bg-slate-300/60 absolute top-2 right-2"></div>
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col gap-2.5">
                      <div className="h-4 w-3/4 bg-slate-200 rounded-md"></div>
                      <div className="h-3 w-1/3 bg-slate-200/80 rounded-md"></div>
                      <div className="h-3 w-full bg-slate-200/60 rounded-md"></div>
                      <div className="h-3 w-4/5 bg-slate-200/60 rounded-md"></div>
                      <div className="h-8 w-full bg-slate-200 rounded-lg mt-3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : facilities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200/80 bg-white p-4 text-center text-[12px] text-slate-500">
                {searchQuery
                  ? "No facilities match your current search. Try adjusting your search."
                  : "No facilities found."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
                {facilities.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="flex flex-col h-full rounded-xl bg-white border border-slate-200/80 overflow-hidden">
                    <div className="relative w-full h-24 sm:h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 overflow-hidden rounded-t-lg relative">
                      <span
                        className={`absolute top-2 right-2 z-10 px-2.5 py-0.5 text-[11px] font-medium rounded-full ${
                          item.available
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-slate-100 text-slate-600 border border-slate-300/60"
                        }`}
                      >
                        {item.available ? "Available" : "Maintenance"}
                      </span>
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                          <ImageIcon size={32} strokeWidth={1.5} className="mb-1" />
                          <span className="text-xs">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 p-2.5 justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 min-h-[2.5rem]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          <UserGroupIcon size={12} className="inline mr-1" />
                          Capacity:{" "}
                          <span className="text-slate-700">
                            {item.capacity || "-"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-tight mb-3 min-h-[2rem]">
                          {item.description || "No description available"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenBooking(item)}
                        className="w-full mt-auto py-2 px-3 text-xs font-semibold rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors duration-150"
                      >
                        Request Booking
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vehicles Section (Shown if mainFilter is 'all' or 'vehicle') */}
        {(mainFilter === "all" || mainFilter === "vehicle") && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <Car size={18} className="text-emerald-700" /> Vehicles Overview (
              {filteredVehicles.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
                    <div className="w-full h-28 sm:h-32 bg-slate-200/70 relative">
                      <div className="w-14 h-4 rounded-full bg-slate-300/60 absolute top-2 right-2"></div>
                    </div>
                    <div className="p-3 sm:p-4 flex flex-col gap-2.5">
                      <div className="h-4 w-3/4 bg-slate-200 rounded-md"></div>
                      <div className="h-3 w-1/3 bg-slate-200/80 rounded-md"></div>
                      <div className="h-3 w-full bg-slate-200/60 rounded-md"></div>
                      <div className="h-3 w-4/5 bg-slate-200/60 rounded-md"></div>
                      <div className="h-8 w-full bg-slate-200 rounded-lg mt-3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200/80 bg-white p-4 text-center text-[12px] text-slate-500">
                {searchQuery
                  ? "No vehicles match your current search. Try adjusting your search."
                  : "No vehicles found in this category."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
                {filteredVehicles.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="flex flex-col h-full rounded-xl bg-white border border-slate-200/80 overflow-hidden">
                    <div className="relative w-full h-24 sm:h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 overflow-hidden rounded-t-lg relative">
                      <span
                        className={`absolute top-2 right-2 z-10 px-2.5 py-0.5 text-[11px] font-medium rounded-full ${
                          item.available
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-slate-100 text-slate-600 border border-slate-300/60"
                        }`}
                      >
                        {item.available ? "Available" : "Maintenance"}
                      </span>
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                          <ImageIcon size={32} strokeWidth={1.5} className="mb-1" />
                          <span className="text-xs">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 p-2.5 justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 min-h-[2.5rem]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          <UserGroupIcon size={12} className="inline mr-1" />
                          Unit Details:{" "}
                          <span className="text-slate-700">
                            {item.unit_name || item.capacity || "-"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-tight mb-3 min-h-[2rem]">
                          {item.description || "No description available"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenBooking(item)}
                        className="w-full mt-auto py-2 px-3 text-xs font-semibold rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors duration-150"
                      >
                        Request Booking
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <FacilityBookingModal
        isOpen={!!selectedResource && resourceType === "facility"}
        onClose={() => setSelectedResource(null)}
        onSubmit={handleBookingSubmit}
        selectedFacility={selectedResource}
      />

      <VehicleBookingModal
        isOpen={!!selectedResource && resourceType === "vehicle"}
        onClose={() => setSelectedResource(null)}
        onSubmit={handleBookingSubmit}
        selectedVehicle={selectedResource}
      />
    </div>
  );
}
