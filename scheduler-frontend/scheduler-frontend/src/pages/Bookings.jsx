import { useEffect, useState } from "react";
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
} from "lucide-react";
import * as api from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

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
    // Skip self and non-approved bookings
    const bId = b.id || b.booking_id;
    const targetId = targetBooking.id || targetBooking.booking_id;
    if (bId === targetId) continue;
    if ((b.status || "").toLowerCase() !== "approved") continue;

    const bResource = (b.resource || b.resource_name || b.item_name || "")
      .trim()
      .toLowerCase();
    if (bResource !== targetResource) continue;

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

export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // Default to pending tab for quick moderation
  const canModerate = user?.role === "admin";

  useEffect(() => {
    api
      .fetchBookings()
      .then((res) => {
        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];
        setBookings(data);
      })
      .catch(() => {});
  }, []);

  async function handleStatusChange(id, status) {
    const targetBooking = bookings.find((b) => (b.id || b.booking_id) === id);

    // If attempting to approve, check for time and date conflicts
    if (status === "approved" && targetBooking) {
      const hasConflict = hasTimeDateConflict(targetBooking, bookings);
      if (hasConflict) {
        alert(
          "Conflict detected: This resource is already booked for the selected date and time. The request has been automatically rejected. Please advise the user to reschedule.",
        );
        status = "rejected";
      }
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === id || b.booking_id === id ? { ...b, status } : b,
      ),
    );
    try {
      await api.updateBookingStatus(id, status);
    } catch {
      // Handle error
    }
  }

  async function handleDeleteAllApproved() {
    const approvedBookings = bookings.filter(
      (b) => (b.status || "").toLowerCase() === "approved",
    );

    if (approvedBookings.length === 0) {
      alert("No approved bookings to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${approvedCount} approved booking(s)? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const approvedIds = approvedBookings.map((b) => b.id || b.booking_id);

    // Optimistically remove approved bookings from state
    setBookings((prev) =>
      prev.filter((b) => !approvedIds.includes(b.id || b.booking_id)),
    );

    try {
      await Promise.all(
        approvedIds.map((id) =>
          api.deleteBooking
            ? api.deleteBooking(id)
            : api.updateBookingStatus(id, "deleted"),
        ),
      );
    } catch {
      // Revert/refetch on failure
      api
        .fetchBookings()
        .then((res) => {
          const data = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
          setBookings(data);
        })
        .catch(() => {});
    }
  }

  // Count metrics for tabs
  const pendingCount = bookings.filter(
    (b) => (b.status || "").toLowerCase() === "pending",
  ).length;
  const approvedCount = bookings.filter(
    (b) => (b.status || "").toLowerCase() === "approved",
  ).length;
  const rejectedCount = bookings.filter(
    (b) => (b.status || "").toLowerCase() === "rejected",
  ).length;

  // Filter bookings based on selected tab
  const filteredBookings = bookings.filter((b) => {
    const status = (b.status || "").toLowerCase();
    if (activeTab === "all") return true;
    return status === activeTab;
  });

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
      <header className="border-b border-line bg-white px-6 py-4">
        <h1 className="text-[17px] font-semibold">Bookings</h1>
        <p className="text-[13px] text-steel">
          Manage and review facility and vehicle reservation requests
        </p>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* Tab Buttons Navigation & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-gray-100 text-steel hover:bg-gray-200 hover:text-gray-900"
              }`}>
              Pending
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-800"
                }`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "approved"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 text-steel hover:bg-gray-200 hover:text-gray-900"
              }`}>
              Approved
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "approved"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-100 text-emerald-800"
                }`}>
                {approvedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "rejected"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-gray-100 text-steel hover:bg-gray-200 hover:text-gray-900"
              }`}>
              Rejected
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === "rejected"
                    ? "bg-rose-700 text-white"
                    : "bg-rose-100 text-rose-800"
                }`}>
                {rejectedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition ${
                activeTab === "all"
                  ? "bg-gray-800 text-white shadow-sm"
                  : "bg-gray-100 text-steel hover:bg-gray-200 hover:text-gray-900"
              }`}>
              All ({bookings.length})
            </button>
          </div>

          {canModerate && approvedCount > 0 && (
            <button
              onClick={handleDeleteAllApproved}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-lg text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition shadow-sm">
              <Trash2 size={14} /> Delete All Approved ({approvedCount})
            </button>
          )}
        </div>

        {/* Bookings Grid Section */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-line rounded-xl bg-gray-50/50">
            <p className="text-[14px] text-steel italic">{getEmptyMessage()}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookings.map((b) => {
              const bookingId = b.id || b.booking_id;
              const resourceName =
                b.resource || b.resource_name || b.item_name || "Resource";

              const barangayName =
                b.barangay ||
                b.user?.barangay ||
                b.user?.name ||
                b.name ||
                "Poblacion";

              const fullName =
                b.full_name ||
                b.requester ||
                b.user_name ||
                b.user?.full_name ||
                "Unknown Requestor";

              const cellNumber = b.cell_number || b.contact || b.phone || "N/A";

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
                <div
                  key={bookingId}
                  className="flex flex-col justify-between border border-line rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">
                          Resource
                        </span>
                        <h3 className="text-[15px] font-bold text-gray-900 leading-tight">
                          {resourceName}
                        </h3>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Details block */}
                    <div className="space-y-2 rounded-md bg-gray-50 p-3 text-[13px] text-steel mb-4">
                      <div className="flex items-center gap-2">
                        <Building2
                          size={14}
                          className="shrink-0 text-gray-400"
                        />
                        <span>
                          <strong className="text-gray-700">Barangay:</strong>{" "}
                          {barangayName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <User size={14} className="shrink-0 text-gray-400" />
                        <span>
                          <strong className="text-gray-700">Full Name:</strong>{" "}
                          {fullName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone size={14} className="shrink-0 text-gray-400" />
                        <span className="font-mono">
                          <strong className="text-gray-700 font-sans">
                            Cell Number:
                          </strong>{" "}
                          {cellNumber}
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin
                          size={14}
                          className="shrink-0 text-gray-400 mt-0.5"
                        />
                        <span>
                          <strong className="text-gray-700">Address:</strong>{" "}
                          {addressValue}
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <FileText
                          size={14}
                          className="shrink-0 text-gray-400 mt-0.5"
                        />
                        <span>
                          <strong className="text-gray-700">Purpose:</strong>{" "}
                          {purposeValue}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="border-t border-line pt-3 mb-3 text-[12.5px] font-mono text-steel space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{dateValue}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-gray-400" />
                        <span>{timeValue}</span>
                      </div>
                    </div>

                    {canModerate && isPendingItem && (
                      <div className="flex gap-2 pt-2 border-t border-line">
                        <button
                          onClick={() =>
                            handleStatusChange(bookingId, "approved")
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 rounded border border-status-approved bg-status-approvedBg py-1.5 text-[13px] font-medium text-status-approved hover:bg-emerald-50 transition">
                          <Check size={14} /> Approve
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(bookingId, "rejected")
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 rounded border border-status-rejected bg-status-rejectedBg py-1.5 text-[13px] font-medium text-status-rejected hover:bg-rose-50 transition">
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
      </div>
    </div>
  );
}
