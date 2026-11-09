import { useState } from "react";
import { createPortal } from "react-dom";
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
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700", icon: <Clock size={14} /> },
  approved: { label: "Approved", className: "border-blue-200 bg-blue-50 text-blue-700", icon: <CheckCircle size={14} /> },
  rejected: { label: "Rejected", className: "border-rose-200 bg-rose-50 text-rose-700", icon: <XCircle size={14} /> },
};

export default function BookingDetailModal({
  booking,
  onClose,
  onApprove,
  onReject,
  canModerate = false,
}) {
  if (!booking) return null;

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
  const email = booking.email || booking.user?.email || "N/A";
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booking Details
            </p>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-800">
              Booking #{bookingId} — {resourceName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            title="Close"
            aria-label="Close booking details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="border-b border-slate-100 pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resource
              </h3>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusConfig.className}`}
              >
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div>
                <p className="text-base font-bold text-slate-800">{resourceName}</p>
                <span className="mt-1 inline-block rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {resourceType}
                </span>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-100 pb-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reservation Schedule
            </h3>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Calendar size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Date Range</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{dateValue}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Time Slot</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{timeValue}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-slate-100 pb-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Applicant Details
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <User size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Full Name</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{fullName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Barangay</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{barangayName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Contact Number</p>
                  <p className="mt-0.5 font-mono text-sm font-medium text-slate-800">{cellNumber}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="mt-0.5 break-all text-sm font-medium text-slate-800">{email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Address</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{address}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Purpose / Additional Notes
            </h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{purposeValue}</p>
            </div>
          </section>

          {status === "rejected" && remarks && (
            <section className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Remarks
              </h3>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="whitespace-pre-wrap text-sm text-rose-800">{remarks}</p>
              </div>
            </section>
          )}
        </div>

        <div
          className="flex w-full flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onClose}
            className="h-10 w-full rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:w-auto"
          >
            Close
          </button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {isPending && canModerate ? (
              <>
                <button
                  onClick={handleRejectClick}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 sm:w-auto"
                >
                  <X size={14} /> Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
                >
                  <Check size={14} /> Approve
                </button>
              </>
            ) : canModerate ? (
              <span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-500 sm:w-auto">
                <FileText size={14} /> No actions available
              </span>
            ) : null}
          </div>
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
    </div>,
    document.body,
  );
}
