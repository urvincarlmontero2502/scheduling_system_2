import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Calendar, Clock, User, Building2, Phone, FileText, Mail, MapPin, CheckCircle, XCircle, Trash2 } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import * as api from "../api/endpoints";
import {
  calculateDailyBookingEstimate,
  calculateBookingHourlyEstimate,
  formatRentalDuration,
  formatResourcePrice,
} from "../utils/resourcePricing";
import { getBookingResourceNames } from "../utils/bookingResources";

function escapeHtml(value) {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

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
  onDelete,
  onRequestRemoval,
  canModerate = false,
  canRemoveApproved = false,
  canRemovePending = false,
  canRequestRemoval = false,
}) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showRequestRemovalConfirm, setShowRequestRemovalConfirm] = useState(false);
  const [removalRequestStatus, setRemovalRequestStatus] = useState("");

  const bookingId = booking?.id || booking?.booking_id;
  const status = (booking?.status || "pending").toLowerCase();
  const isPending = status === "pending";
  const canRemoveBooking =
    onDelete &&
    ((isPending && canRemovePending) ||
      (status === "approved" && canRemoveApproved));

  useEffect(() => {
    let active = true;
    setRemovalRequestStatus("");

    if (!bookingId || !canRequestRemoval || !["pending", "approved"].includes(status)) {
      return () => {
        active = false;
      };
    }

    api.fetchBookingRemovalRequest(bookingId)
      .then((response) => {
        if (active) setRemovalRequestStatus(response?.data?.status || "");
      })
      .catch((error) => {
        if (active) {
          console.error("Failed to load booking removal request status:", error);
        }
      });

    return () => {
      active = false;
    };
  }, [bookingId, canRequestRemoval, status]);

  if (!booking) return null;

  const resourceNames = getBookingResourceNames(booking);
  const primaryResourceName = resourceNames[0];
  const resourceName = resourceNames.join(", ");
  const resourceType =
    (booking.resource_type || booking.item_type || "").toLowerCase().includes("vehicle")
      ? "Vehicle"
      : "Facility";
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const fullName =
    booking.full_name || booking.requester || booking.user_name || booking.user?.full_name || "Unknown Requestor";
  const submittedBy = booking.submitted_by || booking.user || null;
  const submittedByName =
    submittedBy?.full_name ||
    (booking.owner_user_id != null ? `User #${booking.owner_user_id}` : "Account unavailable");
  const submittedByEmail = submittedBy?.email || "";
  const submittedById = submittedBy?.user_id ?? booking.owner_user_id;
  const submittedByAccount = submittedByEmail
    ? `${submittedByName} (${submittedByEmail})`
    : submittedById != null
      ? `${submittedByName} (User ID ${submittedById})`
      : submittedByName;
  const barangayName =
    booking.barangay || booking.user?.barangay || booking.user?.full_name || booking.user?.name || "Poblacion";
  const cellNumber = booking.cell_number || booking.contact || booking.phone || "N/A";
  const email = booking.email || booking.user?.email || "N/A";
  const address =
    booking.where_do_you_live || booking.address || booking.location || booking.user_address || "N/A";
  const destination = booking.destination || booking.travel_destination || "";
  const attendees = booking.attendees;
  const priority = booking.priority || "normal";
  const vehicleDetails = resourceType === "Vehicle"
    ? (Array.isArray(booking.vehicles) && booking.vehicles.length
        ? booking.vehicles
        : [{
            resource_id: booking.resource_id,
            name: primaryResourceName,
            price_per_hour: booking.price_per_hour,
          }])
    : [];
  const vehicleHourlyEstimates = vehicleDetails.map((vehicle) => {
    const hourlyRate =
      vehicle.price_per_hour ??
      vehicle.pivot?.price_per_hour ??
      (String(vehicle.resource_id) === String(booking.resource_id)
        ? booking.price_per_hour
        : null);
    return {
      vehicle,
      rate: hourlyRate,
      estimate: calculateBookingHourlyEstimate({
        ...booking,
        price_per_hour: hourlyRate,
      }),
    };
  });
  const totalVehicleEstimate =
    vehicleHourlyEstimates.length > 0 &&
    vehicleHourlyEstimates.every(({ estimate }) => Number.isFinite(estimate?.total))
      ? vehicleHourlyEstimates.reduce((total, { estimate }) => total + estimate.total, 0)
      : null;
  const hourlyEstimate =
    resourceType === "Vehicle" ? calculateBookingHourlyEstimate(booking) : null;
  const dailyEstimate =
    resourceType === "Facility"
      ? calculateDailyBookingEstimate(
          booking.start_date,
          booking.end_date || booking.start_date,
          booking.price_per_day,
        )
      : null;
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

  const handleRemove = () => {
    setShowRemoveConfirm(true);
  };

  const handleCancelReject = () => {
    setShowRejectInput(false);
    setRejectionReason("");
  };

  const handleGenerateSOA = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to generate the SOA.");
      return;
    }

    const referenceNumber = booking.reference_id || `#${bookingId}`;
    const amount =
      resourceType === "Vehicle" ? totalVehicleEstimate : dailyEstimate?.total;
    const hasAmount = Number.isFinite(amount);
    const chargeBasis =
      resourceType === "Vehicle"
        ? `${formatRentalDuration(hourlyEstimate?.durationMinutes || 0)}; ${
            hourlyEstimate?.billableHours ?? "—"
          } billable hours. ${vehicleHourlyEstimates.map(({ vehicle, rate, estimate }) =>
            `${vehicle.name}: ${formatResourcePrice(rate)} per hour, ${estimate?.total == null ? "for assessment" : formatResourcePrice(estimate.total)}`
          ).join("; ")}`
        : `${dailyEstimate?.billableDays ?? "—"} booked calendar days at ${
            dailyEstimate?.dailyRate == null
              ? "rate to be assessed"
              : `${formatResourcePrice(dailyEstimate.dailyRate)} per day`
          }`;
    const destinationRow = destination
      ? `<tr><th>Destination</th><td>${escapeHtml(destination)}</td></tr>`
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Statement of Account - ${escapeHtml(referenceNumber)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 32px; color: #172033; font: 14px Arial, Helvetica, sans-serif; }
          .document { max-width: 760px; margin: 0 auto; }
          header { text-align: center; padding-bottom: 18px; border-bottom: 2px solid #172033; }
          header h1 { margin: 0; font-size: 19px; }
          header h2 { margin: 6px 0 0; font-size: 16px; }
          header p { margin: 4px 0 0; color: #526174; font-size: 12px; }
          h3 { margin: 24px 0 16px; text-align: center; font-size: 20px; letter-spacing: .04em; }
          .reference { display: flex; justify-content: space-between; gap: 20px; margin: 18px 0; padding: 14px; border: 1px solid #cbd5e1; background: #f8fafc; }
          .reference span, .amount span { display: block; margin-bottom: 5px; color: #526174; font-size: 11px; text-transform: uppercase; }
          .reference strong { font-size: 15px; }
          table { width: 100%; margin-top: 16px; border-collapse: collapse; }
          th, td { padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
          th { width: 30%; background: #f8fafc; }
          .amount { margin-top: 18px; padding: 16px; border: 1px solid #bfdbfe; background: #eff6ff; text-align: right; }
          .amount strong { color: #1e40af; font-size: 22px; }
          .note { margin-top: 18px; padding: 12px; border-left: 3px solid #2563eb; background: #f8fafc; line-height: 1.5; }
          .signature { display: flex; justify-content: space-between; gap: 48px; margin-top: 70px; }
          .signature div { width: 50%; padding-top: 8px; border-top: 1px solid #64748b; text-align: center; font-size: 12px; }
          footer { margin-top: 28px; color: #64748b; text-align: center; font-size: 11px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <main class="document">
          <header>
            <h1>REPUBLIC OF THE PHILIPPINES</h1>
            <h2>MUNICIPALITY OF JABONGA</h2>
            <p>AGUSAN DEL NORTE</p>
          </header>
          <h3>STATEMENT OF ACCOUNT</h3>
          <div class="reference">
            <div><span>Reference Number</span><strong>${escapeHtml(referenceNumber)}</strong></div>
            <div><span>Booking ID</span><strong>#${escapeHtml(bookingId)}</strong></div>
            <div><span>Date Issued</span><strong>${escapeHtml(new Date().toLocaleDateString("en-PH"))}</strong></div>
          </div>
          <table>
            <tbody>
              <tr><th>Client</th><td>${escapeHtml(fullName)}</td></tr>
              <tr><th>Submitted By Account</th><td>${escapeHtml(submittedByAccount)}</td></tr>
              <tr><th>Barangay</th><td>${escapeHtml(barangayName)}</td></tr>
              <tr><th>Contact Number</th><td>${escapeHtml(cellNumber)}</td></tr>
              <tr><th>Resource</th><td>${escapeHtml(resourceName)} (${escapeHtml(resourceType)})</td></tr>
              <tr><th>Booking Date</th><td>${escapeHtml(dateValue)}</td></tr>
              <tr><th>Time</th><td>${escapeHtml(timeValue)}</td></tr>
              <tr><th>Charge Basis</th><td>${escapeHtml(chargeBasis)}</td></tr>
              ${destinationRow}
              <tr><th>Purpose</th><td>${escapeHtml(purposeValue)}</td></tr>
            </tbody>
          </table>
          <div class="amount">
            <span>Amount Due</span>
            <strong>${hasAmount ? escapeHtml(formatResourcePrice(amount)) : "For assessment at the municipal office"}</strong>
          </div>
          <p class="note">
            This SOA is for the approved booking shown above and is not an official receipt.
            Bring this statement to the municipal office and quote the reference number to make payment.
            ${hasAmount ? "The amount is subject to verification by the municipal office." : "The payable amount will be assessed by the municipal office."}
          </p>
          <div class="signature">
            <div>Client / Authorized Representative</div>
            <div>Office Verification</div>
          </div>
          <footer>Generated by the Web-Based Real-Time Scheduling System</footer>
        </main>
        <script>window.onload = function () { window.print(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resourceNames.length > 1 ? "Requested Vehicles" : "Resource"}
                </p>
                <ul className="mt-1 space-y-1">
                  {resourceNames.map((name, index) => (
                    <li key={`${name}-${index}`} className="text-base font-bold text-slate-800">
                      {name}
                    </li>
                  ))}
                </ul>
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

          {hourlyEstimate && (
            <section className="border-b border-slate-100 pb-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Hourly Cost Estimate
              </h3>
              <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
                {vehicleHourlyEstimates.map(({ vehicle, rate, estimate }) => (
                  <p key={vehicle.resource_id || vehicle.id || vehicle.name}>
                    <strong>{vehicle.name}:</strong>{" "}
                    {estimate?.total == null
                      ? "Rate to be assessed"
                      : `${formatResourcePrice(estimate.total)} (${formatResourcePrice(rate)} / hour)`}
                  </p>
                ))}
                <p>
                  <strong>Duration:</strong>{" "}
                  {formatRentalDuration(hourlyEstimate.durationMinutes)} ·{" "}
                  {hourlyEstimate.billableHours} billable hours (partial hours round up)
                </p>
                <p className="mt-1 flex items-center justify-between border-t border-blue-100 pt-2">
                  <strong>Estimated total</strong>
                  <strong>
                    {totalVehicleEstimate === null
                      ? "For assessment"
                      : formatResourcePrice(totalVehicleEstimate)}
                  </strong>
                </p>
              </div>
            </section>
          )}

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
                <User size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Submitted By Account</p>
                  <p className="mt-0.5 break-all text-sm font-medium text-slate-800">
                    {submittedByAccount}
                  </p>
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
              {destination && (
                <div className="flex items-start gap-3">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Destination</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{destination}</p>
                  </div>
                </div>
              )}
              {attendees !== null && attendees !== undefined && attendees !== "" && (
                <div className="flex items-start gap-3">
                  <User size={17} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Attendees</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{attendees}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <FileText size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Priority</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">
                    {priority === "high" ? "High Priority" : "Normal"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin size={17} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Address</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{address}</p>
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
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              onClick={onClose}
              className="h-10 flex-1 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:flex-none"
            >
              Close
            </button>
            {canRemoveBooking && (
              <button
                onClick={handleRemove}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 sm:flex-none"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
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
            ) : ["pending", "approved"].includes(status) && canRequestRemoval && onRequestRemoval ? (
              removalRequestStatus === "pending" ? (
                <span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-4 text-sm font-medium text-amber-700 sm:w-auto">
                  <Clock size={14} /> Removal request pending
                </span>
              ) : (
                <button
                  onClick={() => setShowRequestRemovalConfirm(true)}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 sm:w-auto"
                >
                  <FileText size={14} /> Request removal
                </button>
              )
            ) : null}
            {status === "approved" && (
              <button
                onClick={handleGenerateSOA}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                <FileText size={14} /> Generate SOA
              </button>
            )}
            {canModerate && !["pending", "approved"].includes(status) && (
              <span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-500 sm:w-auto">
                <FileText size={14} /> No actions available
              </span>
            )}
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
      <ConfirmModal
        open={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={async () => {
          const removed = await onDelete?.(bookingId);
          if (removed !== false) setShowRemoveConfirm(false);
        }}
        title={`Remove ${status} booking`}
        message={`Are you sure you want to remove ${status} booking #${bookingId}? This action cannot be undone.`}
        confirmText="Remove"
        titleIcon={Trash2}
        titleIconColor="text-rose-600"
        confirmButtonClass="bg-rose-600 hover:bg-rose-700"
      />
      <ConfirmModal
        open={showRequestRemovalConfirm}
        onClose={() => setShowRequestRemovalConfirm(false)}
        onConfirm={async () => {
          const submitted = await onRequestRemoval?.(bookingId);
          if (submitted !== false) {
            setRemovalRequestStatus("pending");
            setShowRequestRemovalConfirm(false);
          }
        }}
        title="Request booking removal"
        message={`Send a removal request for booking #${bookingId} to the administrators for review? Your booking will remain active until it is approved.`}
        confirmText="Send request"
        titleIcon={FileText}
        titleIconColor="text-amber-600"
        confirmButtonClass="bg-amber-600 hover:bg-amber-700"
      />
    </div>,
    document.body,
  );
}
