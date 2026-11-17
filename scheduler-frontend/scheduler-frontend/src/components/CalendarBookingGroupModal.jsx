import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronRight, Clock, X } from "lucide-react";
import { getBookingResourceNames } from "../utils/bookingResources";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "";
  const time = String(value).trim();
  if (/\b(am|pm)\b/i.test(time)) return time;
  const [hoursPart, minutesPart = "00"] = time.split(":");
  const hours = Number(hoursPart);
  if (!Number.isFinite(hours)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${minutesPart.slice(0, 2)} ${suffix}`;
}

function getScheduleLabel(booking) {
  const startDate = booking.start_date || booking.date;
  const endDate = booking.end_date || startDate;
  const dateLabel =
    startDate && endDate && startDate !== endDate
      ? `${formatDate(startDate)} – ${formatDate(endDate)}`
      : formatDate(startDate);
  const startTime = formatTime(booking.start_time);
  const endTime = formatTime(booking.end_time);
  const timeLabel = [startTime, endTime].filter(Boolean).join(" – ");

  return [dateLabel, timeLabel].filter(Boolean).join(" · ");
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("approv")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (value.includes("pend") || value.includes("request")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function CalendarBookingGroupModal({
  group,
  onClose,
  onSelectBooking,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!group) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-booking-group-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">
              Grouped special event
            </p>
            <h2
              id="calendar-booking-group-title"
              className="mt-1 truncate text-lg font-semibold text-slate-900"
            >
              {group.eventName}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar size={13} />
              {getScheduleLabel(group.bookings[0])}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close grouped booking details"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-violet-100 bg-violet-50/70 px-5 py-3">
          <p className="text-xs leading-relaxed text-violet-900">
            {group.resourceNames.length}{" "}
            {group.resourceNames.length === 1 ? "resource" : "resources"} across{" "}
            {group.bookings.length} related booking{" "}
            {group.bookings.length === 1 ? "request" : "requests"}. Select a
            request to view its details.
          </p>
        </div>

        <div className="space-y-2 overflow-y-auto p-4 sm:p-5">
          {group.bookings.map((booking, index) => {
            const resources = getBookingResourceNames(booking);
            const bookingId = booking.id ?? booking.booking_id ?? index;
            const requester =
              booking.requester ||
              booking.full_name ||
              booking.user_name ||
              "Representative";
            const status = booking.status || "Status unavailable";

            return (
              <button
                key={bookingId}
                type="button"
                onClick={() => onSelectBooking(booking)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {resources.join(", ")}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusClass(status)}`}
                    >
                      {status}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>{requester}</span>
                    {booking.reference_id && (
                      <span>{booking.reference_id}</span>
                    )}
                    {(booking.start_time || booking.end_time) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatTime(booking.start_time)}
                        {booking.end_time
                          ? ` – ${formatTime(booking.end_time)}`
                          : ""}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight
                  size={17}
                  className="shrink-0 text-slate-400"
                />
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
