import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { isSpecialEvent } from "../utils/specialEvents";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import BookingDetailModal from "../components/BookingDetailModal";
import {
  readCache,
  writeCache,
  invalidateCache,
  CACHE_KEYS,
} from "../utils/cache";
import {
  Check,
  X,
  Building2,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Clock,
  User,
  Trash2,
  Search,
  LayoutGrid,
  Table2,
} from "lucide-react";
import * as api from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import {
  SkeletonBookingCard,
  SkeletonBookingTableRow,
} from "../components/Skeleton";

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

// Helper to check for date and time conflicts with existing approved bookings
function hasTimeDateConflict(targetBooking, allBookings) {
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
  const tStartMins = timeToMinutes(targetStartTime);
  const tEndMins = timeToMinutes(targetEndTime);

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

    // Check date range overlap
    if (targetStart <= bEnd && bStart <= targetEnd) {
      const bStartTime =
        b.start_time || (b.time ? b.time.split("-")[0]?.trim() : null);
      const bEndTime =
        b.end_time || (b.time ? b.time.split("-")[1]?.trim() : null);
      const bStartMins = timeToMinutes(bStartTime);
      const bEndMins = timeToMinutes(bEndTime);

      // If either booking spans all day (missing times), treat as a time conflict on overlapping dates
      if (
        tStartMins === null ||
        tEndMins === null ||
        bStartMins === null ||
        bEndMins === null
      ) {
        return true;
      }

      // Check time overlap within the matching dates
      if (Math.max(tStartMins, bStartMins) < Math.min(tEndMins, bEndMins)) {
        return true;
      }
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
            className="px-4 py-2 text-[13px] font-medium text-steel hover:bg-gray-50 rounded-lg border border-line"
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
  const [bookings, setBookings] = useState(() => {
    const cached = readCache(CACHE_KEYS.BOOKINGS);
    return cached && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = readCache(CACHE_KEYS.BOOKINGS);
    return !(cached && cached.length > 0);
  });
  const [activeTab, setActiveTab] = useState("pending");
  const [viewMode, setViewMode] = useState("card");
  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectBooking, setRejectBooking] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canModerate = user?.role === "admin";

  useEffect(() => {
    // If cached data exists, render immediately and background-fetch
    const cached = readCache(CACHE_KEYS.BOOKINGS);
    if (cached && cached.length > 0) {
      setBookings(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    api
      .fetchBookings()
      .then((res) => {
        const d = res?.data;
        const data = Array.isArray(d)
          ? d
          : Array.isArray(d?.data)
            ? d.data
            : Array.isArray(res)
              ? res
              : [];
        if (data.length > 0) writeCache(CACHE_KEYS.BOOKINGS, data);
        setBookings(data);
      })
      .catch(() => {
        // Show user-friendly error toast instead of silently failing
        if (!toast) return;
        toast.error("Unable to load bookings");
      })
      .finally(() => setLoading(false));

    // Listen for cache invalidation events from other pages
    const handler = () => {
      const cached = readCache(CACHE_KEYS.BOOKINGS);
      if (cached) setBookings(cached);
    };
    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("bookingUpdated", handler);
    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("bookingUpdated", handler);
    };
  }, []);

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
    const previousStatus = targetBooking?.status;

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

    // --- Optimistic: update local state + cache immediately ---
    const prevBookings = [...bookings];
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id || b.booking_id === id ? { ...b, status } : b,
      ),
    );
    writeCache(
      CACHE_KEYS.BOOKINGS,
      prevBookings.map((b) =>
        b.id === id || b.booking_id === id ? { ...b, status } : b,
      ),
    );

    try {
      if (status === "rejected" && reason) {
        await api.updateBookingStatus(id, status, { remarks: reason });
      } else {
        await api.updateBookingStatus(id, status);
      }
      toast.success(`Booking ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`);
      window.dispatchEvent(new Event("cacheInvalidated"));
      invalidateCache(CACHE_KEYS.HEALTH);
    } catch (err) {
      // --- Rollback ---
      setBookings(prevBookings);
      writeCache(CACHE_KEYS.BOOKINGS, prevBookings);
      toast.error(
        err?.response?.data?.message || "Could not update the booking status.",
      );
    }
  }

  // Real requests only: special events are never counted, listed or bulk-deleted
  const requests = bookings.filter((b) => !isSpecialEvent(b));

  async function handleDeleteAllApproved() {
    const approvedBookings = requests.filter(
      (b) => (b.status || "").toLowerCase() === "approved",
    );

    if (approvedBookings.length === 0) {
      toast.info("No approved bookings to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${approvedBookings.length} approved booking(s)? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const approvedIds = approvedBookings.map((b) => b.id || b.booking_id);
    const prevBookings = [...bookings];

    // Optimistically remove approved bookings from state + cache
    const updated = bookings.filter(
      (b) => !approvedIds.includes(b.id || b.booking_id),
    );
    setBookings(updated);
    writeCache(CACHE_KEYS.BOOKINGS, updated);

    try {
      await Promise.all(
        approvedIds.map((id) =>
          api.deleteBooking
            ? api.deleteBooking(id)
            : api.updateBookingStatus(id, "deleted"),
        ),
      );
      toast.success(`${approvedBookings.length} booking(s) deleted successfully`);
      window.dispatchEvent(new Event("cacheInvalidated"));
    } catch {
      // Revert on failure
      setBookings(prevBookings);
      writeCache(CACHE_KEYS.BOOKINGS, prevBookings);
      toast.error("Failed to delete some bookings. Please try again.");
    }
  }

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
    <div className="pb-12">
      <header className="border-b border-line bg-white px-4 sm:px-6 py-4">
        <h1 className="text-[17px] font-semibold">Bookings</h1>
        <p className="text-[13px] text-steel">
          Manage and review facility and vehicle reservation requests
        </p>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Search & Barangay Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by resource, applicant, purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-full block rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-brand box-border"
            />
          </div>

          <select
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand"
          >
            <option value="all">All Barangays</option>
            {barangayOptions.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[12px] text-steel">View:</span>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-line">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded transition text-sm font-medium ${
                  viewMode === "card"
                    ? "bg-white shadow border border-line text-ink"
                    : "text-steel hover:text-ink"
                }`}
                title="Card View"
              >
                <LayoutGrid size={16} />
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
                <Table2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 border border-line">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-steel hover:text-ink"
              }`}
            >
              Pending
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {pendingCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "approved"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-steel hover:text-ink"
              }`}
            >
              Approved
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "approved"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {approvedCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "rejected"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-steel hover:text-ink"
              }`}
            >
              Rejected
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "rejected"
                    ? "bg-rose-700 text-white"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {rejectedCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "all"
                  ? "bg-gray-800 text-white shadow-sm"
                  : "text-steel hover:text-ink"
              }`}
            >
              All ({requests.length})
            </button>
          </div>

          {canModerate && approvedCount > 0 && (
            <button
              onClick={handleDeleteAllApproved}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-lg text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition shadow-sm"
            >
              <Trash2 size={14} /> Delete All Approved ({approvedCount})
            </button>
          )}
        </div>

        {/* Content Section */}
        {loading ? (
          viewMode === "card" ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 max-w-full">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBookingCard key={`skeleton-card-${i}`} />
              ))}
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
          <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
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

                  return (
                    <tr key={bookingId} className="hover:bg-gray-50">
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
                          <Calendar size={13} className="text-gray-400" />
                          <span>{dateValue}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-steel mt-1 font-mono text-[12px]">
                          <Clock size={13} className="text-gray-400" />
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
                                className="mt-auto w-full py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Approve"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectBooking(b);
                                  setRejectModalOpen(true);
                                }}
                                className="mt-auto w-full py-1.5 text-xs font-semibold rounded-lg border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
                                title="Reject"
                              >
                                <X size={12} /> Reject
                              </button>
                            </>
                          )}
                          {!canModerate && (
                            <button
                              onClick={() => {}}
                              className="flex items-center justify-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-steel hover:bg-gray-50 transition"
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 max-w-full">
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
              const addressValue =
                b.where_do_you_live ||
                b.address ||
                b.location ||
                b.user_address ||
                "N/A";
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

              return (
                <div
                  key={bookingId}
                  onClick={() => setSelectedBooking(b)}
                  className="cursor-pointer overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md flex flex-col"
                >
                  {/* Resource + Status header */}
                  <div className="flex justify-between items-start gap-2 p-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-steel">
                        Resource
                      </span>
                      <h3 className="text-[13px] font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.5rem]">
                        {resourceName}
                      </h3>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={b.status} />
                    </div>
                  </div>

                  {/* Date & Time chips */}
                  <div className="px-2.5 mb-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-[10px] font-medium text-blue-800">
                      <Calendar size={10} />
                      {dateValue}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-1 text-[10px] font-medium text-purple-800">
                      <Clock size={10} />
                      {timeValue}
                    </span>
                  </div>

                  {/* Details block */}
                  <div className="space-y-1.5 rounded-md bg-gray-50 p-2.5 text-[11px] mb-3">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="shrink-0 text-gray-400" />
                      <span>
                        <strong className="text-gray-700">Name:</strong>{" "}
                        {fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2
                        size={12}
                        className="shrink-0 text-gray-400"
                      />
                      <span>
                        <strong className="text-gray-700">Brgy:</strong>{" "}
                        {barangayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="shrink-0 text-gray-400" />
                      <span className="font-mono">
                        <strong className="text-gray-700 font-sans">
                          Cell:
                        </strong>{" "}
                        {cellNumber}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <FileText
                        size={12}
                        className="shrink-0 text-gray-400 mt-0.5"
                      />
                      <span className="line-clamp-2">
                        <strong className="text-gray-700">Purpose:</strong>{" "}
                        {purposeValue}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {canModerate && isPendingItem && (
                    <div className="mt-auto flex gap-2 p-2 pt-0 w-full" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          handleStatusChange(bookingId, "approved")
                        }
                        className="mt-auto w-full sm:w-1/2 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectBooking(b);
                          setRejectModalOpen(true);
                        }}
                        className="mt-auto w-full sm:w-1/2 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
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
      </div>

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
