import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Building2, Car, Image as ImageIcon } from "lucide-react";
import * as api from "../api/endpoints";
import FacilityBookingModal from "../components/FacilityBookingModal";
import VehicleBookingModal from "../components/VehicleBookingModal";

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const [apiStatus, setApiStatus] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  const [selectedResource, setSelectedResource] = useState(null);
  const [mainFilter, setMainFilter] = useState("all"); // "all" | "facility" | "vehicle"
  const [vehicleSubFilter, setVehicleSubFilter] = useState("all"); // "all" | "heavy" | "ambulance" | "service"

  useEffect(() => {
    let isMounted = true;

    api
      .checkHealth?.()
      .then((res) => {
        if (!isMounted) return;
        setApiStatus(res.data?.api ?? true);
        setDbStatus(res.data?.database ?? true);
      })
      .catch(() => {
        if (!isMounted) return;
        setApiStatus(false);
        setDbStatus(false);
      });

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

        const pendingCount = bookings.filter(
          (b) => b?.status?.toLowerCase() === "pending",
        ).length;

        const approvedCount = bookings.filter(
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
      destination: payload.destination || null,
      address: payload.address || null,
      cell_number: payload.cell_number,
    };

    api
      .createBooking(apiPayload)
      .then(() => {
        alert("Booking request submitted successfully!");
        setSelectedResource(null);
      })
      .catch((err) => {
        console.error("Failed to submit booking request", err);
        alert("Failed to submit booking request.");
      });
  };

  const facilities = resources.filter(
    (r) => r?.type?.toLowerCase() === "facility",
  );
  const vehicles = resources.filter(
    (r) => r?.type?.toLowerCase() === "vehicle",
  );

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
      label: "Active facilities",
      value: loading ? "..." : facilities.length,
      tone: "text-ink",
    },
    {
      label: "Active vehicles",
      value: loading ? "..." : vehicles.length,
      tone: "text-ink",
    },
  ];

  const resourceType = selectedResource?.type?.toLowerCase();

  return (
    <div>
      <header className="flex flex-col gap-3 border-b border-line bg-white px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[17px] font-semibold">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-[13px] text-steel">
            Here's what's happening with facility and vehicle bookings. Click
            any resource below to make a request.
          </p>
        </div>

        {/* API & DB Status Indicators */}
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
      <div className="grid grid-cols-4 gap-4 px-6 py-6">
        {STATS_ITEMS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <p className={`font-mono text-[28px] font-semibold ${stat.tone}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-[13px] text-steel">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="px-6 pb-6 space-y-6">
        {/* Filter Navigation Block */}
        <div className="border-b border-line pb-4 space-y-3">
          {/* Main Filter Navigation Buttons */}
          <div className="flex items-center gap-2">
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

          {/* Sub-category pills for vehicles (Shown below buttons when viewing Vehicles) */}
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
        </div>

        {/* Facilities Section (Shown if mainFilter is 'all' or 'facility') */}
        {(mainFilter === "all" || mainFilter === "facility") && (
          <div>
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-3">
              <Building2 size={18} className="text-brand" /> Facilities Overview
              ({facilities.length})
            </h2>
            {loading ? (
              <p className="text-[13px] text-steel">Loading facilities...</p>
            ) : facilities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[13px] text-steel">
                No facilities found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facilities.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="cursor-pointer overflow-hidden rounded-lg border border-line bg-white shadow-sm hover:border-brand hover:shadow-md transition">
                    <div className="h-36 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line">
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-steel gap-1">
                          <ImageIcon size={24} />
                          <span className="text-[11px]">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <h3 className="text-[14px] font-semibold text-ink">
                          {item.name}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${item.available ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {item.available ? "Available" : "Booked"}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] text-steel">
                        Capacity:{" "}
                        <span className="font-medium text-ink">
                          {item.capacity || "—"}
                        </span>
                      </p>
                      <p className="mt-1 text-[12.5px] text-steel truncate">
                        Description: {item.description || "None"}
                      </p>
                      <div className="mt-3 text-[12px] font-medium text-brand">
                        Click to request booking &rarr;
                      </div>
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
            <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2 mb-3">
              <Car size={18} className="text-brand" /> Vehicles Overview (
              {filteredVehicles.length})
            </h2>
            {loading ? (
              <p className="text-[13px] text-steel">Loading vehicles...</p>
            ) : filteredVehicles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[13px] text-steel">
                No vehicles found in this category.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVehicles.map((item) => (
                  <div
                    key={item.resource_id || item.id}
                    onClick={() => handleOpenBooking(item)}
                    className="cursor-pointer overflow-hidden rounded-lg border border-line bg-white shadow-sm hover:border-brand hover:shadow-md transition">
                    <div className="h-36 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line">
                      {item.image && item.image.trim() !== "" ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-steel gap-1">
                          <ImageIcon size={24} />
                          <span className="text-[11px]">No image provided</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <h3 className="text-[14px] font-semibold text-ink">
                          {item.name}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${item.available ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {item.available ? "Available" : "Booked"}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] text-steel">
                        Unit Details:{" "}
                        <span className="font-medium text-ink">
                          {item.unit_name || item.capacity || "—"}
                        </span>
                      </p>
                      <p className="mt-1 text-[12.5px] text-steel truncate">
                        Description: {item.description || "None"}
                      </p>
                      <div className="mt-3 text-[12px] font-medium text-brand">
                        Click to request booking &rarr;
                      </div>
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
