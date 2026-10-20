import { useState, useEffect } from "react";
import { isSpecialEvent } from "../utils/specialEvents";
import { useAuth } from "../context/AuthContext";
import { Search, Building2, Car, Image as ImageIcon, Users as UserGroupIcon } from "lucide-react";
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
      tone: "text-status-pending",
    },
    {
      label: "Approved this week",
      value: loading ? "..." : (stats.approved ?? 0),
      tone: "text-status-approved",
    },
    {
      label: "Facilities",
      value: loading
        ? "..."
        : `${availableFacilities.length}/${allFacilities.length}`,
      subLabel: "(available/total)",
      tone: "text-ink",
    },
    {
      label: "Vehicles",
      value: loading
        ? "..."
        : `${availableVehicles.length}/${allVehicles.length}`,
      subLabel: "(available/total)",
      tone: "text-ink",
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
      <div className="grid grid-cols-2 gap-2.5 mb-3 lg:grid-cols-4 lg:gap-4">
        {STATS_ITEMS.map((stat) => (
          <div
            key={stat.label}
            className={`p-2.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs ${loading ? "animate-pulse" : ""}`}>
            <p className="font-mono text-lg sm:text-xl font-bold text-slate-900">
              {loading ? (
                <span className="inline-block h-7 w-12 bg-slate-200 rounded-md"></span>
              ) : (
                stat.value
              )}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-500 font-medium">
              {stat.label}
              {stat.subLabel ? ` ${stat.subLabel}` : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 pb-8 sm:pb-12">
        {/* Mobile: Search full-width at top, pills below */}
        <div className="sm:hidden mt-3 sm:mt-4 mb-2 w-full">
          <div className="relative w-full">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel"
            />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs py-2 pl-9 pr-3 rounded-lg border border-slate-200 bg-white shadow-2xs outline-none focus:border-brand"
            />
          </div>
          <div className="flex overflow-x-auto gap-2 py-1 mb-2 no-scrollbar whitespace-nowrap w-full">
            <button
              onClick={() => {
                setMainFilter("all");
                setVehicleSubFilter("all");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                mainFilter === "all"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              All Resources ({resources.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("facility");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                mainFilter === "facility"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              Facilities ({facilities.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("vehicle");
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                mainFilter === "vehicle"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              Vehicles ({vehicles.length})
            </button>
          </div>
        </div>

        {/* Desktop: Category pills left, search right in same row */}
        <div className="hidden sm:flex items-center justify-between gap-4 w-full">
          <div className="flex overflow-x-auto gap-2 no-scrollbar whitespace-nowrap">
            <button
              onClick={() => {
                setMainFilter("all");
                setVehicleSubFilter("all");
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "all"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              All Resources ({resources.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("facility");
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "facility"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              Facilities ({facilities.length})
            </button>
            <button
              onClick={() => {
                setMainFilter("vehicle");
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition ${
                mainFilter === "vehicle"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white border border-line text-steel hover:bg-paper"
              }`}>
              Vehicles ({vehicles.length})
            </button>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel"
            />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 lg:w-80 text-xs py-2 pl-9 pr-3 rounded-lg border border-slate-200 bg-white shadow-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
            }}
            className="text-[12px] text-brand hover:underline">
            Clear search
          </button>
        )}
        {/* Sub-category pills for vehicles */}
        {mainFilter === "vehicle" && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[12px] text-steel mr-1 font-medium">
              Vehicle Type:
            </span>
            <button
              onClick={() => setVehicleSubFilter("all")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                vehicleSubFilter === "all"
                  ? "bg-ink text-white"
                  : "bg-paper border border-line text-steel hover:bg-gray-100"
              }`}>
              All ({vehicles.length})
            </button>
            <button
              onClick={() => setVehicleSubFilter("heavy")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                vehicleSubFilter === "heavy"
                  ? "bg-ink text-white"
                  : "bg-paper border border-line text-steel hover:bg-gray-100"
              }`}>
              Heavy Equipment ({heavyEquipment.length})
            </button>
            <button
              onClick={() => setVehicleSubFilter("ambulance")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                vehicleSubFilter === "ambulance"
                  ? "bg-ink text-white"
                  : "bg-paper border border-line text-steel hover:bg-gray-100"
              }`}>
              Ambulances ({ambulances.length})
            </button>
            <button
              onClick={() => setVehicleSubFilter("service")}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                vehicleSubFilter === "service"
                  ? "bg-ink text-white"
                  : "bg-paper border border-line text-steel hover:bg-gray-100"
              }`}>
              Service Vehicles ({serviceVehicles.length})
            </button>
          </div>
        )}

        {/* Facilities Section (Shown if mainFilter is 'all' or 'facility') */}
        {(mainFilter === "all" || mainFilter === "facility") && (
          <div>
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-4">
              <Building2 size={18} className="text-brand" /> Facilities Overview
              ({facilities.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
                    <div className="w-full h-28 sm:h-32 bg-slate-200/70 relative">
                      <div className="w-16 h-5 rounded-full bg-slate-300/60 absolute top-2.5 right-2.5"></div>
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
              <div className="rounded-lg border border-dashed border-line bg-white p-4 text-center text-[12px] text-steel">
                {searchQuery
                  ? "No facilities match your current search. Try adjusting your search."
                  : "No facilities found."}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {facilities.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="flex flex-col h-full rounded-xl bg-white border border-line overflow-hidden">
                    <div className="relative w-full h-20 sm:h-28 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 overflow-hidden rounded-t-lg relative">
                      <span
                        className={`absolute top-1.5 right-1.5 z-10 px-2.5 py-0.5 text-[11px] font-medium rounded-full ${
                          item.available
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-gray-50 text-gray-700 border border-gray-200/60"
                        }`}
                      >
                        {item.available ? "Available" : "Booked"}
                      </span>
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-steel gap-1">
                          <ImageIcon size={24} strokeWidth={1.5} className="text-gray-300 opacity-60" />
                          <span className="text-[10px] text-gray-400">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 p-2.5 justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug min-h-[2rem] mb-0.5">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium mb-2">
                          <UserGroupIcon size={12} className="inline mr-1" />
                          Capacity:{" "}
                          <span className="text-ink">
                            {item.capacity || "N/A"}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight mb-2 min-h-[2rem] overflow-hidden">
                          {item.description || "No description available"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenBooking(item)}
                        className="w-full mt-auto py-1.5 px-2 text-[11px] font-semibold rounded-md border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
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
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-4">
              <Car size={18} className="text-brand" /> Vehicles Overview (
              {filteredVehicles.length})
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
                    <div className="w-full h-28 sm:h-32 bg-slate-200/70 relative">
                      <div className="w-16 h-5 rounded-full bg-slate-300/60 absolute top-2.5 right-2.5"></div>
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
              <div className="rounded-lg border border-dashed border-line bg-white p-4 text-center text-[12px] text-steel">
                {searchQuery
                  ? "No vehicles match your current search. Try adjusting your search."
                  : "No vehicles found in this category."}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {filteredVehicles.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="flex flex-col h-full rounded-xl bg-white border border-line overflow-hidden">
                    <div className="relative w-full h-20 sm:h-28 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 overflow-hidden rounded-t-lg relative">
                      <span
                        className={`absolute top-1.5 right-1.5 z-10 px-2.5 py-0.5 text-[11px] font-medium rounded-full ${
                          item.available
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-gray-50 text-gray-700 border border-gray-200/60"
                        }`}
                      >
                        {item.available ? "Available" : "Booked"}
                      </span>
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-steel gap-1">
                          <ImageIcon size={24} strokeWidth={1.5} className="text-gray-300 opacity-60" />
                          <span className="text-[10px] text-gray-400">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 p-2.5 justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug min-h-[2rem] mb-0.5">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium mb-2">
                          <UserGroupIcon size={12} className="inline mr-1" />
                          Unit Details:{" "}
                          <span className="text-ink">
                            {item.unit_name || item.capacity || "N/A"}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight mb-2 min-h-[2rem] overflow-hidden">
                          {item.description || "No description available"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenBooking(item)}
                        className="w-full mt-auto py-1.5 px-2 text-[11px] font-semibold rounded-md border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
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
