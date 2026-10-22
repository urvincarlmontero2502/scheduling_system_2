import { useState } from "react";
import { X, Check, Calendar, Clock, User, Building2, Phone, FileText, Mail, MapPin, CheckCircle, XCircle } from "lucide-react";

// Helper to format date
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Helper to format time
function formatTime(timeStr) {
  if (!timeStr) return "";
  if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) {
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

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800", icon: <Clock size={16} /> },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800", icon: <CheckCircle size={16} /> },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-800", icon: <XCircle size={16} /> },
};

export default function BookingDetailModal({ booking, onClose, onApprove, onReject }) {
  if (!booking) return null;

  console.log("Selected Booking Data:", booking);

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const bookingId = booking.id || booking.booking_id;
  const resourceName =
    booking.resource || booking.resource_name || booking.item_name || "Unknown Resource";
  const resourceType =
    (booking.resource_type || booking.item_type || "").toLowerCase().includes("vehicle")
      ? "Vehicle"
      : "Facility";
  const status = (booking.status || "pending").toLowerCase();
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const fullName =
    booking.full_name || booking.requester || booking.user_name || booking.user?.full_name || "Unknown Requestor";
  const barangayName =
    booking.barangay || booking.user?.barangay || booking.user?.full_name || booking.user?.name || "Poblacion";
  const cellNumber = booking.cell_number || booking.contact || booking.phone || "N/A";
  const email = booking.email || booking.applicant_email || booking.user?.email || "N/A";
  const address =
    booking.where_do_you_live || booking.address || booking.location || booking.user_address || "N/A";
  const purposeValue =
    booking.purpose || booking.reason || booking.description || booking.details || "No purpose provided";
  const remarks = booking.remarks || booking.admin_remarks || "";

  const startDate = booking.start_date || booking.date;
  const endDate = booking.end_date || booking.date;
  const dateValue =
    startDate && endDate && startDate !== endDate
      ? `${formatDate(startDate)} to ${formatDate(endDate)}`
      : formatDate(startDate || endDate);

  let timeValue = "All Day";
  if (booking.start_time && booking.end_time) {
    timeValue = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
  } else if (booking.start_time) {
    timeValue = formatTime(booking.start_time);
  } else if (booking.time) {
    const parts = booking.time.split("-");
    if (parts.length === 2) {
      timeValue = `${formatTime(parts[0].trim())} - ${formatTime(parts[1].trim())}`;
    } else {
      timeValue = formatTime(booking.time);
    }
  }

  const isPending = status === "pending";

  const handleApprove = () => {
    if (onApprove) onApprove(bookingId);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    if (onReject) onReject(bookingId, rejectionReason);
  };

  const handleRejectClick = () => {
    setShowRejectInput(true);
    setRejectionReason("");
  };

  const handleCancelReject = () => {
    setShowRejectInput(false);
    setRejectionReason("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 sm:px-6 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Booking Details</h2>
            <p className="text-[12px] text-steel mt-0.5">
              Booking #{bookingId} — {resourceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-steel hover:bg-gray-100"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Resource & Status */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">
                Resource
              </span>
              <p className="text-[15px] font-bold text-ink mt-1">{resourceName}</p>
              <span className="inline-block mt-1 text-[11px] text-steel bg-gray-100 px-2 py-0.5 rounded-full">
                {resourceType}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">
                Status
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${statusConfig.className}`}
              >
                <span>{statusConfig.icon}</span>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Reservation Schedule */}
          <div className="border-t border-line pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-steel block mb-3">
              Reservation Schedule
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Date Range</p>
                  <p className="text-[13px] font-medium text-ink">{dateValue}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Time Slot</p>
                  <p className="text-[13px] font-medium text-ink">{timeValue}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Applicant Details */}
          <div className="border-t border-line pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-steel block mb-3">
              Applicant Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Full Name</p>
                  <p className="text-[13px] font-medium text-ink">{fullName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Barangay</p>
                  <p className="text-[13px] font-medium text-ink">{barangayName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Contact Number</p>
                  <p className="text-[13px] font-medium text-ink font-mono">{cellNumber}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Email</p>
                  <p className="text-[13px] font-medium text-ink break-all">{email}</p>
                </div>
              </div>
              <div className="sm:col-span-2 flex items-start gap-3">
                <MapPin size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[11px] text-steel">Address</p>
                  <p className="text-[13px] font-medium text-ink">{address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose & Notes */}
          <div className="border-t border-line pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-steel block mb-2">
              Purpose / Additional Notes
            </span>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[13px] text-ink">{purposeValue}</p>
            </div>
          </div>

          {/* Admin Remarks (if rejected) */}
          {status === "rejected" && remarks && (
            <div className="border-t border-line pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-steel block mb-2">
                Admin Remarks
              </span>
              <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
                <p className="text-[13px] text-rose-800">{remarks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div
          className="border-t border-line px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-end gap-2 w-full"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onClose}
            className="w-full sm:w-auto h-11 px-4 py-2.5 text-[13px] font-medium text-steel hover:bg-gray-50 rounded-lg border border-line"
          >
            Close
          </button>
          {isPending ? (
            <>
              <button
                onClick={handleRejectClick}
                className="w-full sm:w-auto h-11 mt-auto sm:mt-0 py-1.5 px-4 text-xs font-semibold rounded-lg border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
              >
                <X size={14} /> Reject
              </button>
              <button
                onClick={handleApprove}
                className="w-full sm:w-auto h-11 mt-auto sm:mt-0 py-1.5 px-4 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check size={14} /> Approve
              </button>
            </>
          ) : (
            <button
              onClick={() => {}}
              className="w-full sm:w-auto h-11 mt-auto sm:mt-0 py-1.5 px-4 text-xs font-semibold rounded-lg bg-gray-100"
              disabled
            >
              <FileText size={14} /> No actions available
            </button>
          )}
        </div>

        {/* Rejection Reason Modal */}
        {showRejectInput && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={handleCancelReject}
          >
            <div
              className="w-[95vw] max-w-md rounded-xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-3 text-[15px] font-semibold text-ink">
                Reason for Rejection
              </h3>
              <p className="mb-3 text-[12.5px] text-steel">
                Please provide a reason for rejecting this booking request.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full rounded-lg border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-rose-500"
                rows={4}
              />
              {!rejectionReason.trim() && (
                <p className="mt-2 text-[11.5px] text-rose-600">
                  Rejection reason is required.
                </p>
              )}
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={handleCancelReject}
                  className="h-10 px-4 py-2 text-[13px] font-medium text-steel hover:bg-gray-50 rounded-lg border border-line"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="h-10 flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={14} /> Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
