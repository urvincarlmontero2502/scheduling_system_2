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
  Calendar,
  Clock,
  User,
  Search,
  LayoutGrid,
  Table2,
  ImageIcon,
} from "lucide-react";
import * as api from "../api/endpoints";
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
  const bufferMinutes = Math.max(
    0,
    Number(targetBooking.buffer_minutes ?? 30),
  );
  const targetResource = (
    targetBooking.resource ||
    targetBooking.resource_name ||
    targetBooking.item_name ||
    ""
  )
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

    const bResource = (b.resource || b.resource_name || b.item_name || "")
      .trim()
      .toLowerCase();
    if (b.resource_id != null && targetBooking.resource_id != null) {
      if (String(b.resource_id) !== String(targetBooking.resource_id)) continue;
    } else if (bResource !== targetResource) {
      continue;
    }

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
            Booking #{booking?.id || booking?.booking_id} — {booking?.resource || booking?.resource_name || "Resource"}
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
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectBooking, setRejectBooking] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canModerate = user?.role === "admin";

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
      if (status === "rejected" && reason) {
        await api.updateBookingStatus(id, status, { remarks: reason });
      } else {
        await api.updateBookingStatus(id, status);
      }
      toast.success(`Booking ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`);
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

    const searchText = search.toLowerCase();
    if (searchText) {
      const resource =
        typeof b.resource === "object"
          ? b.resource?.name || b.resource?.resource_name || b.resource_name || b.item_name || ""
          : b.resource || b.resource_name || b.item_name || "";
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
                  const resourceName =
                    b.resource || b.resource_name || b.item_name || "Resource";
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
                      <td className="px-4 py-3 text-[13px] text-steel max-w-[200px] truncate">
                        {purposeValue}
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
          <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">{filteredBookings.map((b) => {
              const bookingId = b.id || b.booking_id;
              const resourceName =
                b.resource || b.resource_name || b.item_name || "Resource";
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
                  className="flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative mb-3 h-36 w-full overflow-hidden bg-blue-50/70">
                    {resourceImage ? (
                      <img
                        src={resourceImage}
                        alt={resourceName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        <ImageIcon
                          size={32}
                          strokeWidth={1.5}
                          className="mb-1 opacity-60"
                        />
                        <span className="text-xs">No image provided</span>
                      </div>
                    )}
                    <span className={`absolute right-2 top-2 z-10 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-xs ${statusBadgeClasses}`}>
                      {b.status || "PENDING"}
                    </span>
                  </div>

                  <div className="mb-3 px-4">
                    <h3 className="text-lg font-bold text-slate-800">
                      {resourceName}
                    </h3>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2 px-4">
                    <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <Calendar size={10} />
                      {dateValue}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <Clock size={10} />
                      {timeValue}
                    </span>
                  </div>

                  <div className="mx-4 my-3 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">
                        <strong className="text-slate-700">Requester:</strong>{" "}
                        {fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">
                        <strong className="text-slate-700">Barangay:</strong>{" "}
                        {barangayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="shrink-0 text-slate-400" />
                      <span className="font-mono truncate">
                        <strong className="text-slate-700">Contact:</strong>{" "}
                        {cellNumber}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <FileText
                        size={12}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <span className="line-clamp-2">
                        <strong className="text-slate-700">Purpose:</strong>{" "}
                        {purposeValue}
                      </span>
                    </div>
                  </div>

                  {canModerate && isPendingItem && (
                    <div className="mt-2 grid grid-cols-2 gap-3 px-4 pb-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusChange(bookingId, "approved");
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setRejectBooking(b);
                          setRejectModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  )}
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
        />
      )}
    </div>
  );
}
