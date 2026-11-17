import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { isSpecialEvent } from "../utils/specialEvents";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useCachedData } from "../hooks/useCachedData";
import { useTabUrlSync, useViewModeUrlSync } from "../hooks/useTabUrlSync";
import { writeCache, invalidateCache, CACHE_KEYS } from "../utils/cache";
import BookingDetailModal from "../components/BookingDetailModal";
import {
  Check,
  X,
  Building2,
  Phone,
  FileText,
  MapPin,
  Calendar,
  Clock,
  User,
  Search,
  LayoutGrid,
  Table2,
  ImageIcon,
} from "lucide-react";
import * as api from "../api/endpoints";
import {
  calculateBookingHourlyEstimate,
  formatRentalDuration,
  formatResourcePrice,
} from "../utils/resourcePricing";
import {
  getBookingResourceIds,
  getBookingResourceNames,
} from "../utils/bookingResources";
import StatusBadge from "../components/StatusBadge";
import {
  SkeletonBookingCard,
  SkeletonBookingTableRow,
} from "../components/Skeleton";

// Helper to look up resource image by resource_id or name
function getResourceImage(booking, resources) {
  // Check all possible image keys on the booking object directly
  const directImage =
    booking.resource?.image_url ||
    booking.resource?.image ||
    booking.vehicles?.[0]?.image_url ||
    booking.facility?.image_url ||
    booking.vehicle?.image_url ||
    booking.image_url;

  if (directImage) {
    return directImage;
  }

  // Fallback: look up in resources array by ID or name
  const rid = booking.resource_id;
  const name = booking.resource || booking.resource_name || booking.item_name || "";
  const match =
    (rid != null && resources.find((r) => String(r.id || r.resource_id) === String(rid))) ||
    resources.find((r) =>
      (r.name || r.resource_name || r.item_name || "")
        .toLowerCase() === name.toLowerCase()
    );
  // Check all possible image keys
  return match?.image || match?.image_url || match?.photo_url || match?.photo || "";
}

// Console log for debugging
function logBookingDebug(booking) {
  console.log("Booking Card Payload:", booking);
}

function calculateVehicleBookingEstimate(booking) {
  const vehicles = Array.isArray(booking.vehicles) && booking.vehicles.length
    ? booking.vehicles
    : [{ price_per_hour: booking.price_per_hour }];
  const resourceNames = getBookingResourceNames(booking);
  const estimates = vehicles.map((vehicle) =>
    calculateBookingHourlyEstimate({
      ...booking,
      price_per_hour:
        vehicle.price_per_hour ??
        vehicle.pivot?.price_per_hour ??
        (String(vehicle.resource_id) === String(booking.resource_id)
          ? booking.price_per_hour
          : null),
    }),
  );
  const firstEstimate = estimates[0];
  if (!firstEstimate) return null;

  return {
    ...firstEstimate,
    total: estimates.every((estimate) => Number.isFinite(estimate?.total))
      ? estimates.reduce((total, estimate) => total + estimate.total, 0)
      : null,
    resourceEstimates: vehicles.map((vehicle, index) => ({
      name:
        vehicle.name ||
        vehicle.resource_name ||
        resourceNames[index] ||
        `Resource ${index + 1}`,
      total: estimates[index]?.total ?? null,
    })),
  };
}

// Helper function to convert 24hr time (e.g., "17:00") to 12hr AM/PM format (e.g., "5:00 PM")
function formatTimeTo12Hour(timeStr) {
  if (!timeStr) return "";
  if (
    timeStr.toLowerCase().includes("am") ||
    timeStr.toLowerCase().includes("pm")
  ) {
    return timeStr;
  }
  const [hourStr, minuteStr] = timeStr.split(":");
  let hours = parseInt(hourStr, 10);
  if (isNaN(hours)) return timeStr;
  const minutes = minuteStr ? minuteStr.slice(0, 2) : "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Helper function to convert time string to minutes from midnight for accurate comparison
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr
    .toLowerCase()
    .replace(/\s*(am|pm)/, "")
    .trim();
  const parts = clean.split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return null;
  if (timeStr.toLowerCase().includes("pm") && h < 12) h += 12;
  if (timeStr.toLowerCase().includes("am") && h === 12) h = 0;
  return h * 60 + m;
}

function dateTimeToMinutes(date, time, isEnd = false) {
  const datePart = String(date || "").split("T")[0];
  const dayStart = Date.parse(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(dayStart)) return null;
  return (
    dayStart / 60000 +
    (timeToMinutes(time) ?? (isEnd ? 24 * 60 : 0))
  );
}

// Helper to check for date and time conflicts with existing approved bookings
function hasTimeDateConflict(targetBooking, allBookings) {
  const targetResourceIds = getBookingResourceIds(targetBooking);
  const targetResource = getBookingResourceNames(targetBooking)
    .join(", ")
    .trim()
    .toLowerCase();
  const targetStart = targetBooking.start_date || targetBooking.date;
  const targetEnd = targetBooking.end_date || targetBooking.date || targetStart;
  if (!targetStart) return false;

  const targetStartTime =
    targetBooking.start_time ||
    (targetBooking.time ? targetBooking.time.split("-")[0]?.trim() : null);
  const targetEndTime =
    targetBooking.end_time ||
    (targetBooking.time ? targetBooking.time.split("-")[1]?.trim() : null);
  const tStartMins = dateTimeToMinutes(targetStart, targetStartTime);
  const tEndMins = dateTimeToMinutes(targetEnd, targetEndTime, true);

  for (const b of allBookings) {
    const bId = b.id || b.booking_id;
    const targetId = targetBooking.id || targetBooking.booking_id;
    if (bId === targetId) continue;
    if ((b.status || "").toLowerCase() !== "approved") continue;

    const bResource = getBookingResourceNames(b)
      .join(", ")
      .trim()
      .toLowerCase();
    const matchingResourceIds = targetResourceIds.filter((id) =>
      getBookingResourceIds(b).includes(id),
    );
    if (
      matchingResourceIds.length === 0 &&
      bResource !== targetResource
    ) {
      continue;
    }
    const bufferMinutes = Math.max(
      0,
      ...matchingResourceIds.map((id) => {
        const vehicle = targetBooking.vehicles?.find(
          (item) => String(item.resource_id || item.id) === id,
        );
        return Number(vehicle?.buffer_minutes ?? targetBooking.buffer_minutes ?? 30);
      }),
    );

    const bStart = b.start_date || b.date;
    const bEnd = b.end_date || b.date || bStart;
    if (!bStart) continue;
    const bStartTime =
      b.start_time || (b.time ? b.time.split("-")[0]?.trim() : null);
    const bEndTime =
      b.end_time || (b.time ? b.time.split("-")[1]?.trim() : null);
    const bStartMins = dateTimeToMinutes(bStart, bStartTime);
    const bEndMins = dateTimeToMinutes(bEnd, bEndTime, true);

    if (
      [tStartMins, tEndMins, bStartMins, bEndMins].some(
        (value) => value === null,
      )
    ) {
      return true;
    }

    if (
      Math.max(tStartMins, bStartMins - bufferMinutes) <
      Math.min(tEndMins, bEndMins + bufferMinutes)
    ) {
      return true;
    }
  }
  return false;
}

// Reject modal component
function RejectModal({ booking, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink">Reject Booking</h2>
          <p className="text-[12px] text-steel mt-1">
            Booking #{booking?.id || booking?.booking_id} — {getBookingResourceNames(booking).join(", ")}
          </p>
        </div>
        <div className="p-5">
          <label className="block text-[12px] font-medium text-ink mb-1.5">
            Reason for Rejection <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Schedule conflict, resource unavailable, incomplete details..."
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] outline-none focus:border-rose-500 resize-none"
            rows={3}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-steel hover:bg-paper rounded-lg border border-line"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={14} /> Reject Booking
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: bookings, loading, refetch: refetchBookings } = useCachedData("bookings", api.fetchBookings);
  const { data: resources } = useCachedData("resources", api.fetchResources);

  // URL-synchronized tab + view mode
  const [activeTab, setActiveTab] = useTabUrlSync("tab", "pending");
  const [viewMode, setViewMode] = useViewModeUrlSync("card");
  const [search, setSearch] = useState("");
  const [approvedReferenceSearch, setApprovedReferenceSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectBooking, setRejectBooking] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canModerate = user?.role === "admin";
  const canRemoveApproved = ["admin", "barangay_admin"].includes(user?.role);
  const canRemovePending = ["admin", "barangay_admin"].includes(user?.role);

  // Auto-open booking detail modal when arriving from a notification click
  useEffect(() => {
    const bookingIdParam = searchParams.get("bookingId")
    if (!bookingIdParam) return

    const findAndOpen = () => {
      const match = bookings.find(
        (b) => String(b.id || b.booking_id) === String(bookingIdParam)
      )
      if (match) {
        setSelectedBooking(match)
      }
    }

    if (bookings.length > 0) {
      findAndOpen()
    } else {
      // Wait for bookings to load from API
      const timer = setTimeout(findAndOpen, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, bookings])

  async function handleStatusChange(id, status, reason = "") {
    const targetBooking = bookings.find(
      (b) => (b.id || b.booking_id) === id,
    );

    // If attempting to approve, check for time and date conflicts
    if (status === "approved" && targetBooking) {
      const hasConflict = hasTimeDateConflict(targetBooking, bookings);
      if (hasConflict) {
        toast.error(
          "Conflict detected: This resource is already booked for the selected date and time. The request has been automatically rejected.",
        );
        status = "rejected";
      }
    }

    // Optimistically update cache with new status
    const prevBookings = [...bookings];
    const updatedBookings = prevBookings.map((b) =>
      b.id === id || b.booking_id === id ? { ...b, status } : b,
    );
    writeCache(CACHE_KEYS.BOOKINGS, updatedBookings);

    try {
      let response;
      if (status === "rejected" && reason) {
        response = await api.updateBookingStatus(id, status, { remarks: reason });
      } else {
        response = await api.updateBookingStatus(id, status);
      }
      if (response?.data?.email_notification_sent === false) {
        toast.error(
          response.data.email_notification_message ||
            `Booking ${status} but its email notification could not be sent.`,
        );
      } else {
        toast.success(`Booking ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`);
      }
      // Re-fetch cached data and invalidate health cache
      refetchBookings();
      invalidateCache(CACHE_KEYS.HEALTH);
      window.dispatchEvent(new Event("cacheInvalidated"));
    } catch (err) {
      // Rollback cache
      writeCache(CACHE_KEYS.BOOKINGS, prevBookings);
      toast.error(
        err?.response?.data?.message || "Could not update the booking status.",
      );
    }
  }

  async function handleDeleteBooking(id) {
    try {
      await api.deleteBooking(id);
      toast.success("Booking removed successfully.");
      setSelectedBooking(null);
      invalidateCache(CACHE_KEYS.BOOKINGS);
      invalidateCache(CACHE_KEYS.HEALTH);
      window.dispatchEvent(new Event("cacheInvalidated"));
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not remove the booking.",
      );
      return false;
    }
  }

  async function handleRequestBookingRemoval(id) {
    try {
      await api.requestBookingRemoval(id);
      toast.success("Removal request sent for review.");
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not send the removal request.",
      );
      return false;
    }
  }

  // Real requests only: special events are never counted, listed or bulk-deleted
  const requests = bookings.filter((b) => !isSpecialEvent(b));

  // Count metrics for tabs
  const pendingCount = requests.filter(
    (b) => (b.status || "").toLowerCase() === "pending",
  ).length;
  const approvedCount = requests.filter(
    (b) => (b.status || "").toLowerCase() === "approved",
  ).length;
  const rejectedCount = requests.filter(
    (b) => (b.status || "").toLowerCase() === "rejected",
  ).length;

  // Helper to normalize the rejection handler — accepts (id, status) or (id, status, reason)
  const safeReject = (id, reason) => {
    handleStatusChange(id, "rejected", reason);
  };

  // Apply tab + search + barangay filtering
  const filteredBookings = requests.filter((b) => {
    const status = (b.status || "").toLowerCase();
    if (activeTab === "all") {
      /* show all */
    } else if (status !== activeTab) {
      return false;
    }

    if (
      activeTab === "approved" &&
      approvedReferenceSearch.trim() &&
      !String(b.reference_id || "")
        .toLowerCase()
        .includes(approvedReferenceSearch.trim().toLowerCase())
    ) {
      return false;
    }

    const searchText = search.toLowerCase();
    if (searchText) {
      const resource = getBookingResourceNames(b).join(", ");
      const fullName =
        b.full_name || b.requester || b.user_name || b.user?.full_name || "";
      const purpose = b.purpose || b.reason || b.description || "";
      const bookingId = b.id || b.booking_id || "";
      const combined = `${resource} ${fullName} ${purpose} ${bookingId}`.toLowerCase();
      if (!combined.includes(searchText)) return false;
    }

    const barangayName =
      b.barangay ||
      b.user?.barangay ||
      b.user?.full_name ||
      b.user?.name ||
      b.name ||
      "";
    if (barangayFilter !== "all" && barangayName !== barangayFilter) {
      return false;
    }

    return true;
  });

  // Distinct barangay list for filter dropdown
  const barangayOptions = Array.from(
    new Set(
      requests.map(
        (b) =>
          b.barangay ||
          b.user?.barangay ||
          b.user?.full_name ||
          b.user?.name ||
          b.name ||
          "Poblacion",
      ),
    ),
  ).sort();

  const getEmptyMessage = () => {
    switch (activeTab) {
      case "pending":
        return "No pending requests at the moment.";
      case "approved":
        return "No approved bookings yet.";
      case "rejected":
        return "No rejected requests.";
      default:
        return "No bookings found.";
    }
  };

  return (
    <div className="pb-12 space-y-6">
      {/* KPI Summary Cards Row — clickable to toggle filters */}
      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
          {[
            { label: "Pending Requests", value: pendingCount, Icon: Clock, loading, tab: "pending", color: "text-orange-500" },
            { label: "Approved Requests", value: approvedCount, Icon: Check, loading, tab: "approved", color: "text-green-600" },
            { label: "Rejected Requests", value: rejectedCount, Icon: X, loading, tab: "rejected", color: "text-red-500" },
            { label: "Total Requests", value: requests.length, Icon: FileText, loading, tab: "all" },
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={() => stat.tab && setActiveTab(stat.tab)}
              className={`cursor-pointer relative p-2.5 rounded-xl border border-line bg-white shadow-xs hover:border-brand/30 transition-all ${stat.loading ? "animate-pulse" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-mono text-2xl font-bold ${stat.color || "text-ink"}`}>
                  {stat.loading ? (
                    <span className="inline-block h-7 w-10 bg-line rounded-md"></span>
                  ) : (
                    stat.value
                  )}
                </p>
                {stat.Icon && <stat.Icon size={18} className={stat.color ? `${stat.color} opacity-70` : "text-steel opacity-50"} />}
              </div>
              <p className={`mt-1 text-[10px] uppercase tracking-wider font-semibold ${stat.color || "text-steel"}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Consolidated Toolbar — matches Overview.jsx layout */ }
        {activeTab === "approved" && (
          <div className="mb-3 max-w-sm">
            <label htmlFor="approved-reference-search" className="mb-1 block text-xs font-medium text-steel">
              Search approved request by reference
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
              />
              <input
                id="approved-reference-search"
                type="search"
                placeholder="Enter reference ID (e.g. JBG-2026-0001)"
                value={approvedReferenceSearch}
                onChange={(event) => setApprovedReferenceSearch(event.target.value)}
                className="w-full rounded-lg border border-line bg-white py-2 pl-10 pr-3 text-xs outline-none focus:border-brand"
              />
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Left: Status Filter Pills */ }
          <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar whitespace-nowrap w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
                activeTab === "pending"
                                  ? "bg-brand text-white shadow-sm border-brand"
                  : "bg-white border border-line text-steel hover:bg-paper transition-colors"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
                activeTab === "approved"
                                  ? "bg-brand text-white shadow-sm border-brand"
                  : "bg-white border border-line text-steel hover:bg-paper transition-colors"
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
                activeTab === "rejected"
                                  ? "bg-brand text-white shadow-sm border-brand"
                  : "bg-white border border-line text-steel hover:bg-paper transition-colors"
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
                activeTab === "all"
                                  ? "bg-brand text-white shadow-sm border-brand"
                  : "bg-white border border-line text-steel hover:bg-paper transition-colors"
              }`}
            >
              All
            </button>
          </div>

          {/* Right: Search & Dropdown & View Mode */ }
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-[52%] -translate-y-1/2 text-steel pointer-events-none w-4 h-4 flex items-center"
              />
              <input
                type="text"
                placeholder="Search resources, applicants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs py-2 pl-10 pr-3 rounded-lg border border-line bg-paper outline-none focus:border-brand"
              />
            </div>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-line bg-paper shrink-0 outline-none focus:border-brand"
            >
              <option value="all">Show: All Barangays</option>
              {barangayOptions.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-lg border border-line">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded transition text-sm font-medium ${
                  viewMode === "card"
                    ? "bg-white shadow border border-line text-ink"
                    : "text-steel hover:text-ink"
                }`}
                title="Card View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded transition text-sm font-medium ${
                  viewMode === "table"
                    ? "bg-white shadow border border-line text-ink"
                    : "text-steel hover:text-ink"
                }`}
                title="Table View"
              >
                <Table2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          viewMode === "card" ? (
            <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBookingCard key={`skeleton-card-${i}`} />
              ))}
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-line bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Applicant
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Barangay
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Purpose
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold text-steel">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBookingTableRow key={`skeleton-row-${i}`} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-line rounded-xl bg-gray-50/50">
            <p className="text-[14px] text-steel italic">{getEmptyMessage()}</p>
          </div>
        ) : viewMode === "table" ? (
          <div className="w-full max-w-full overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-line bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel min-w-[150px]">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Barangay
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Purpose
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] font-semibold text-steel">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredBookings.map((b) => {
                  const bookingId = b.id || b.booking_id;
                  const resourceName = getBookingResourceNames(b).join(", ");
                  const barangayName =
                    b.barangay ||
                    b.user?.barangay ||
                    b.user?.full_name ||
                    b.user?.name ||
                    b.name ||
                    "Poblacion";
                  const fullName =
                    b.full_name ||
                    b.requester ||
                    b.user_name ||
                    b.user?.full_name ||
                    "Unknown Requestor";
                  const cellNumber =
                    b.cell_number || b.contact || b.phone || "N/A";
                  const purposeValue =
                    b.purpose ||
                    b.reason ||
                    b.description ||
                    b.details ||
                    "No purpose provided";
                  const destination = b.destination || b.travel_destination || "";
                  const attendees = b.attendees;
                  const priority = b.priority || "normal";
                  const hourlyEstimate =
                    String(b.resource_type || "").toLowerCase() === "vehicle"
                      ? calculateVehicleBookingEstimate(b)
                      : null;

                  const startDate = b.start_date || b.date;
                  const endDate = b.end_date || b.date;
                  const dateValue =
                    startDate && endDate && startDate !== endDate
                      ? `${startDate} to ${endDate}`
                      : startDate || "—";

                  let timeValue = "All Day";
                  if (b.start_time && b.end_time) {
                    timeValue = `${formatTimeTo12Hour(b.start_time)} - ${formatTimeTo12Hour(b.end_time)}`;
                  } else if (b.start_time) {
                    timeValue = formatTimeTo12Hour(b.start_time);
                  } else if (b.time) {
                    const parts = b.time.split("-");
                    if (parts.length === 2) {
                      timeValue = `${formatTimeTo12Hour(parts[0].trim())} - ${formatTimeTo12Hour(parts[1].trim())}`;
                    } else {
                      timeValue = formatTimeTo12Hour(b.time);
                    }
                  }

                  const isPendingItem =
                    (b.status || "").toLowerCase() === "pending";
                  const statusText = b.status || "pending";
                  const statusColor =
                    statusText.toLowerCase() === "approved" ? "bg-status-approved" :
                    statusText.toLowerCase() === "rejected" ? "bg-status-rejected" :
                    "bg-status-pending";

                  return (
                    <tr key={bookingId} className="hover:bg-paper">
                      <td className="px-4 py-3 text-[13px] font-medium text-ink min-w-[150px] whitespace-normal">
                        {resourceName}
                      </td>
                      <td className="px-4 py-3 text-[13px]">{fullName}</td>
                      <td className="px-4 py-3 text-[13px] text-steel">
                        {barangayName}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-steel">
                        {cellNumber}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-steel" />
                          <span>{dateValue}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-steel mt-1 font-mono text-[12px]">
                          <Clock size={13} className="text-steel" />
                          <span>{timeValue}</span>
                        </div>
                      </td>
                      <td className="max-w-[280px] whitespace-normal px-4 py-3 text-[13px] text-steel">
                        <div>{purposeValue}</div>
                        {destination && (
                          <div className="mt-1 text-xs">Destination: {destination}</div>
                        )}
                        {hourlyEstimate && (
                          <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs text-blue-800">
                            <p>
                              <strong>Duration:</strong>{" "}
                              {formatRentalDuration(hourlyEstimate.durationMinutes)}
                            </p>
                            <p>
                              <strong>Billable hours:</strong>{" "}
                              {hourlyEstimate.billableHours} (partial hours round up)
                            </p>
                            <p>
                              <strong>Estimated total:</strong>{" "}
                              {formatResourcePrice(hourlyEstimate.total)}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {canModerate && isPendingItem && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusChange(bookingId, "approved")
                                }
                                className="w-full py-1.5 text-xs font-semibold rounded-lg bg-brand text-white flex items-center justify-center hover:bg-brand-dark"
                                title="Approve"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectBooking(b);
                                  setRejectModalOpen(true);
                                }}
                                className="w-full py-1.5 text-xs font-semibold rounded-lg border border-status-rejected bg-status-rejectedBg flex items-center justify-center hover:bg-rose-100"
                                title="Reject"
                              >
                                <X size={12} /> Reject
                              </button>
                            </>
                          )}
                          {!canModerate && (
                            <button
                              onClick={() => {}}
                              className="w-full py-1.5 text-xs font-semibold rounded-lg border border-line text-steel hover:bg-paper flex items-center justify-center"
                              title="View"
                            >
                              <FileText size={12} /> View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Card View
          <div className="grid grid-cols-1 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">{filteredBookings.map((b) => {
              const bookingId = b.id || b.booking_id;
              const resourceNames = getBookingResourceNames(b);
              const resourceName = resourceNames.join(", ");
              const barangayName =
                b.barangay ||
                b.user?.barangay ||
                b.user?.full_name ||
                b.user?.name ||
                b.name ||
                "Poblacion";
              const fullName =
                b.full_name ||
                b.requester ||
                b.user_name ||
                b.user?.full_name ||
                "Unknown Requestor";
              const cellNumber =
                b.cell_number || b.contact || b.phone || "N/A";
              const purposeValue =
                b.purpose ||
                b.reason ||
                b.description ||
                b.details ||
                "No purpose provided";
              const purposeDisplay = ["n/a", "na", "none"].includes(
                String(purposeValue).trim().toLowerCase(),
              )
                ? "Not provided"
                : purposeValue;
              const destination = b.destination || b.travel_destination || "";
              const attendees = b.attendees;
              const priority = b.priority || "normal";
              const hourlyEstimate =
                String(b.resource_type || "").toLowerCase() === "vehicle"
                  ? calculateVehicleBookingEstimate(b)
                  : null;

              const startDate = b.start_date || b.date;
              const endDate = b.end_date || b.date;
              let dateValue = "—";
              if (startDate && endDate && startDate !== endDate) {
                dateValue = `${startDate} to ${endDate}`;
              } else if (startDate) {
                dateValue = startDate;
              }

              let timeValue = "All Day";
              if (b.start_time && b.end_time) {
                timeValue = `${formatTimeTo12Hour(b.start_time)} - ${formatTimeTo12Hour(b.end_time)}`;
              } else if (b.start_time) {
                timeValue = formatTimeTo12Hour(b.start_time);
              } else if (b.time) {
                const parts = b.time.split("-");
                if (parts.length === 2) {
                  timeValue = `${formatTimeTo12Hour(parts[0].trim())} - ${formatTimeTo12Hour(parts[1].trim())}`;
                } else {
                  timeValue = formatTimeTo12Hour(b.time);
                }
              }

              const isPendingItem =
                (b.status || "").toLowerCase() === "pending";
              const statusText = b.status || "pending";
              const normalizedStatus = statusText.toLowerCase();
              const statusBadgeClasses =
                normalizedStatus === "pending"
                  ? "border-amber-200 bg-amber-50/80 text-amber-700"
                  : normalizedStatus === "rejected"
                    ? "border-rose-200 bg-rose-50/90 text-rose-700"
                    : normalizedStatus === "approved"
                      ? "border-blue-200 bg-blue-50/90 text-blue-700"
                      : "border-slate-200 bg-white/90 text-slate-600";
              const resourceImage = getResourceImage(b, resources);

              return (
                <div
                  key={bookingId}
                  onClick={() => setSelectedBooking(b)}
                  className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="relative h-32 w-full shrink-0 overflow-hidden bg-slate-100">
                    {resourceImage ? (
                      <img
                        src={resourceImage}
                        alt={resourceName}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        <ImageIcon
                          size={30}
                          strokeWidth={1.5}
                          className="mb-1 opacity-60"
                        />
                        <span className="text-[11px]">No image provided</span>
                      </div>
                    )}
                    <span className={`absolute right-3 top-3 z-10 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize shadow-sm backdrop-blur-sm ${statusBadgeClasses}`}>
                      {b.status || "PENDING"}
                    </span>
                    {resourceNames.length > 1 && (
                      <span className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                        {resourceNames.length} resources
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className="line-clamp-2 text-sm font-bold leading-snug text-slate-900"
                          title={resourceName}
                        >
                          {resourceName}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                          priority === "high"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {priority === "high" ? "High priority" : "Normal"}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={13} className="shrink-0 text-slate-400" />
                        {dateValue}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} className="shrink-0 text-slate-400" />
                        {timeValue}
                      </span>
                    </div>

                    {hourlyEstimate && (
                      <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-700">
                              Estimated total
                            </p>
                            <p className="mt-0.5 text-base font-bold leading-tight text-blue-950">
                              {formatResourcePrice(hourlyEstimate.total)}
                            </p>
                          </div>
                          <span className="rounded-full border border-blue-100 bg-white px-2 py-1 text-[9px] font-semibold text-blue-800">
                            {hourlyEstimate.billableHours}{" "}
                            {hourlyEstimate.billableHours === 1 ? "billable hr" : "billable hrs"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[10px] text-blue-800">
                          <strong>Duration:</strong>{" "}
                          {formatRentalDuration(hourlyEstimate.durationMinutes)}
                          <span className="mx-1.5 text-blue-300">·</span>
                          Partial hours round up
                        </p>
                        {hourlyEstimate.resourceEstimates.length > 1 && (
                          <div className="mt-2 border-t border-blue-100 pt-1.5">
                            <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                              {hourlyEstimate.resourceEstimates.map(
                                (resource, index) => (
                                  <div
                                    key={`${resource.name}-${index}`}
                                    className="flex min-w-0 items-center justify-between gap-2 text-[9px] text-blue-900"
                                  >
                                    <span className="min-w-0 truncate">
                                      {resource.name}
                                    </span>
                                    <strong className="shrink-0 text-right">
                                      {formatResourcePrice(resource.total)}
                                    </strong>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="flex min-w-0 items-center gap-2 text-[10px]">
                        <User size={13} className="shrink-0 text-slate-400" />
                        <p className="min-w-0 truncate text-slate-700">
                          <strong className="text-slate-800">{fullName}</strong>
                          <span className="mx-1 text-slate-300">·</span>
                          {barangayName}
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 text-[10px] text-slate-600 sm:grid-cols-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Phone size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate font-mono">{cellNumber}</span>
                        </div>
                        {destination && (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <MapPin size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">{destination}</span>
                          </div>
                        )}
                        <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2">
                          <FileText size={12} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 truncate">
                            <strong className="text-slate-700">Purpose:</strong>{" "}
                            {purposeDisplay}
                          </span>
                        </div>
                        {attendees !== null && attendees !== undefined && attendees !== "" && (
                          <div className="flex items-center gap-1.5 sm:col-span-2">
                            <User size={12} className="shrink-0 text-slate-400" />
                            <span>
                              <strong className="text-slate-700">Attendees:</strong>{" "}
                              {attendees}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                  {canModerate && isPendingItem && (
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusChange(bookingId, "approved");
                        }}
                        className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setRejectBooking(b);
                          setRejectModalOpen(true);
                        }}
                        className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Reject Modal */}
      {rejectModalOpen && rejectBooking && (
        <RejectModal
          booking={rejectBooking}
          onClose={() => {
            setRejectModalOpen(false);
            setRejectBooking(null);
          }}
          onConfirm={(reason) => {
            safeReject(rejectBooking.id || rejectBooking.booking_id, reason);
            setRejectModalOpen(false);
            setRejectBooking(null);
          }}
        />
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          canModerate={canModerate}
          canRemoveApproved={canRemoveApproved}
          canRemovePending={canRemovePending}
          canRequestRemoval={
            !["admin", "barangay_admin"].includes(user?.role) &&
            String(selectedBooking.owner_user_id) === String(user?.user_id)
          }
          onClose={() => {
            setSelectedBooking(null);
            navigate("/bookings", { replace: true });
          }}
          onApprove={(id) => {
            handleStatusChange(id, "approved");
            setSelectedBooking(null);
            navigate("/bookings", { replace: true });
          }}
          onReject={(id, reason) => {
            handleStatusChange(id, "rejected", reason);
            setSelectedBooking(null);
            navigate("/bookings", { replace: true });
          }}
          onDelete={handleDeleteBooking}
          onRequestRemoval={handleRequestBookingRemoval}
        />
      )}
    </div>
  );
}
