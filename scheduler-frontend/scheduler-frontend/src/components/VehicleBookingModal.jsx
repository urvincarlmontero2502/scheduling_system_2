import { useEffect, useState } from "react";
import * as api from "../api/endpoints";
import {
  X,
  Calendar as CalendarIcon,
  MapPin,
  User,
  Phone,
  Mail,
  Home,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Car,
  Loader2,
  Clock,
  Sparkles,
} from "lucide-react";

// Helper: robustly extract date parts from various formats
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const datePart = String(dateStr).split("T")[0];
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return { y, m, d };
};

// Helper: match booking to resource ID
const isMatch = (booking, resourceId) => {
  const bookingResourceId =
    booking.resource_id ??
    booking.item_id ??
    booking.resourceId ??
    booking.resource ??
    null;
  if (bookingResourceId != null) {
    return String(bookingResourceId) === String(resourceId);
  }
  return false;
};

// Helper: determine if status is approved
const isApprovedStatus = (status) => {
  const s = (status || "").toLowerCase();
  return s.includes("approv") || s.includes("accept") || s.includes("confirm") || s === "yes";
};

// Helper: determine if status is pending
const isPendingStatus = (status) => {
  const s = (status || "").toLowerCase();
  return (
    s.includes("pend") ||
    s.includes("request") ||
    s.includes("tentative") ||
    s.includes("submit") ||
    s.includes("waiting") ||
    s === "new"
  );
};

export default function VehicleBookingModal({
  isOpen,
  onClose,
  onSubmit,
  selectedVehicle,
  isDirectUse = false,
}) {
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    start_time: "08:00",
    end_time: "17:00",
    destination: "",
    purpose: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    cell_number: "",
    email: "",
    address: "",
    priority: "normal",
    start_time_changed: false,
  });
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [suggestedSlots, setSuggestedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitAlternatives, setSubmitAlternatives] = useState([]);
  useEffect(() => {
    if (!isOpen) return;
    setCurrentMonthDate(new Date());
    const load = () =>
      api
        .fetchBookings?.()
        .then((res) => {
          const fetchedBookings = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          setBookings(fetchedBookings);
        })
        .catch(() => {
          setBookings([]);
        });
    load();
    window.addEventListener("bookingUpdated", load);
    window.addEventListener("bookingChanged", load);
    return () => {
      window.removeEventListener("bookingUpdated", load);
      window.removeEventListener("bookingChanged", load);
    };
  }, [isOpen]);

  // Fetch available time slots when dates are selected
  const fetchSuggestedSlots = (date, resourceId) => {
    if (!date || !resourceId) {
      setSuggestedSlots([]);
      return;
    }
    setLoadingSlots(true);
    api
      .checkAvailability({
        resource_id: resourceId,
        date: date,
        start_time: formData.start_time,
        end_time: formData.end_time,
      })
      .then((res) => {
        const slots = res?.data?.available_slots || res?.available_slots || [];
        setSuggestedSlots(slots);
      })
      .catch(() => {
        setSuggestedSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  };

  // Auto-fetch suggestions when a single date is selected
  useEffect(() => {
    if (!isOpen || !selectedVehicle) return;
    if (formData.start_date && !formData.end_date && !formData.start_time_changed) {
      const resourceId = selectedVehicle?.resource_id || selectedVehicle?.id;
      fetchSuggestedSlots(formData.start_date, resourceId);
    }
  }, [formData.start_date, formData.end_date, isOpen, selectedVehicle, formData.start_time_changed]);

  // Reset the flag when start_date changes (new date selection)
  useEffect(() => {
    if (!isOpen || !selectedVehicle) return;
    if (formData.start_date) {
      setFormData((prev) => ({ ...prev, start_time_changed: false }));
    }
  }, [formData.start_date, isOpen, selectedVehicle]);

  // EARLY RETURN — after ALL hooks to prevent React error #310
  if (!isOpen || !selectedVehicle) return null;

  // Days of this resource that have approved / pending bookings
  const dayStatus = {};
  const resourceId = selectedVehicle.resource_id || selectedVehicle.id;

  bookings.forEach((b) => {
    const isApproved = isApprovedStatus(b.status);
    const isPending = isPendingStatus(b.status);
    if (!isApproved && !isPending) return;

    const sameResource = isMatch(b, resourceId);
    if (!sameResource) return;

    const startParts = parseDate(b.start_date);
    const endParts = parseDate(b.end_date || b.start_date);
    if (!startParts || !endParts) return;

    const sy = startParts.y, sm = startParts.m, sd = startParts.d;
    const ey = endParts.y, em = endParts.m, ed = endParts.d;
    if (!sy || !ey) return;
    const cur = new Date(sy, sm - 1, sd);
    const last = new Date(ey, em - 1, ed);
    for (let i = 0; cur <= last && i < 366; i++) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      dayStatus[key] = dayStatus[key] || {};
      if (isApproved) dayStatus[key].approved = true;
      if (isPending) dayStatus[key].pending = true;
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Approved bookings of this resource that overlap the chosen dates and times
  // A 30-minute buffer (BUFFER_MINUTES) is enforced after each booking ends
  const BUFFER_MINUTES = 30;
  const toMins = (t) => {
    const m = String(t || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = Number(m[1]);
    const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + Number(m[2]);
  };
  const conflict =
    formData.start_date && formData.end_date
      ? bookings.find((b) => {
          if (!isApprovedStatus(b.status)) return false;
          if (!isMatch(b, resourceId)) return false;
          const bStart = (b.start_date || "").split("T")[0];
          const bEnd = (b.end_date || b.start_date || "").split("T")[0];
          if (!bStart) return false;
          if (!(formData.start_date <= bEnd && bStart <= formData.end_date))
            return false;
          const ns = toMins(formData.start_time);
          const ne = toMins(formData.end_time);
          const bs = toMins(b.start_time);
          const be = toMins(b.end_time);
          if ([ns, ne, bs, be].some((v) => v === null)) return true;
          // Buffer: new booking cannot start within BUFFER_MINUTES
          // after an existing booking ends
          return Math.max(ns, bs) < Math.min(ne, be + BUFFER_MINUTES);
        })
      : null;

  const update = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Apply a suggested slot to the form
  const applySlot = (slot) => {
    update("start_time", slot.start_time);
    update("end_time", slot.end_time);
    update("start_time_changed", true);
    setSuggestedSlots([]);
  };

  // Format minutes to "h:MM AM/PM" for display
  const formatSlotLabel = (start, end) => {
    const fmt = (t) => {
      const m = String(t || "").match(/(\d{1,2}):(\d{2})/i);
      if (!m) return t;
      let h = Number(m[1]);
      const min = m[2];
      const ap = h < 12 ? "AM" : "PM";
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${h}:${min} ${ap}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const getDaysInMonth = (year, month) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () =>
    setCurrentMonthDate(
      new Date(
        currentMonthDate.getFullYear(),
        currentMonthDate.getMonth() - 1,
        1,
      ),
    );
  const handleNextMonth = () =>
    setCurrentMonthDate(
      new Date(
        currentMonthDate.getFullYear(),
        currentMonthDate.getMonth() + 1,
        1,
      ),
    );

  const handleDateClick = (dateString) => {
    if (!formData.start_date || (formData.start_date && formData.end_date)) {
      update("start_date", dateString);
      update("end_date", "");
    } else if (formData.start_date && !formData.end_date) {
      if (dateString < formData.start_date) {
        update("start_date", dateString);
      } else {
        update("end_date", dateString);
      }
    }
  };

  const renderCalendarGrid = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-6 w-6" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const formattedDay = String(day).padStart(2, "0");
      const formattedMonth = String(month + 1).padStart(2, "0");
      const dateString = `${year}-${formattedMonth}-${formattedDay}`;

      const isStart = formData.start_date === dateString;
      const isEnd = formData.end_date === dateString;
      const isInRange =
        formData.start_date &&
        formData.end_date &&
        dateString > formData.start_date &&
        dateString < formData.end_date;

      let cellStyles =
        "relative h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium transition cursor-pointer ";
      if (isStart || isEnd) {
        cellStyles += "bg-brand text-white font-bold shadow-sm";
      } else if (isInRange) {
        cellStyles += "bg-brand/10 text-brand-dark rounded-none";
      } else {
        cellStyles += "text-ink hover:bg-paper";
      }

      const st = dayStatus[dateString];

      days.push(
        <button
          key={dateString}
          type="button"
          onClick={() => handleDateClick(dateString)}
          className={cellStyles}>
          {day}
          {st && (
            <span className="absolute bottom-[1px] left-1/2 flex -translate-x-1/2 items-center gap-0.5">
              {st.approved && (
                <span className="h-1 w-1 rounded-full bg-emerald-500 ring-1 ring-white" />
              )}
              {st.pending && (
                <span className="h-1 w-1 rounded-full bg-amber-500 ring-1 ring-white" />
              )}
            </span>
          )}
        </button>,
      );
    }

    return (
      <div className="rounded-lg border border-line bg-white p-2 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-md p-0.5 text-steel transition hover:bg-paper hover:text-ink">
            <ChevronLeft size={14} />
          </button>
          <h3 className="text-[12.5px] font-semibold text-brand">
            {monthNames[month]} {year}
          </h3>
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-md p-0.5 text-steel transition hover:bg-paper hover:text-ink">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="mb-0.5 grid grid-cols-7 border-b border-line pb-0.5 text-center text-[9px] font-semibold text-steel">
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
        </div>
        <div className="grid grid-cols-7 justify-items-center gap-y-0.5">
          {days}
        </div>
        <div className="mt-1 flex items-center justify-center gap-3 border-t border-line pt-1 text-[9.5px] text-steel">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
            Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending
          </span>
        </div>
      </div>
    );
  };

  const canSubmit =
    formData.start_date &&
    formData.end_date &&
    formData.purpose.trim() &&
    (formData.first_name.trim() || formData.last_name.trim()) &&
    formData.cell_number.length === 11 &&
    formData.email &&
    formData.address.trim() &&
    !conflict;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitAlternatives([]);

    const payload = {
      item_id: selectedVehicle.resource_id || selectedVehicle.id,
      type: "vehicle",
      ...formData,
      full_name: `${formData.first_name}${formData.middle_name ? " " + formData.middle_name : ""} ${formData.last_name}`.trim(),
      status: isDirectUse ? "approved" : "pending",
    };

    Promise.resolve(onSubmit(payload))
      .then(() => {
        onClose();
      })
      .catch((err) => {
        if (err?.type === "conflict") {
          setSubmitError(err.message);
          setSubmitAlternatives(err.alternatives || []);
        } else if (err?.type === "error") {
          setSubmitError(err.message);
          setSubmitAlternatives([]);
        } else {
          setSubmitError("Failed to submit booking request.");
        }
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 p-4"
      onClick={onClose}>
      <div
        className="w-[95%] max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              {isDirectUse ? "Direct Allocation" : "Request Booking"}: {selectedVehicle.name}
            </h2>
            <p className="text-[11.5px] capitalize text-steel">Type: Vehicle</p>
          </div>
          <button onClick={onClose} className="p-1 text-steel hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-start">
            {/* LEFT: image + details - sticky on desktop */}
            <div className="md:col-span-5 md:sticky md:top-0 space-y-4">
              <div className="relative flex h-32 sm:h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
                {selectedVehicle.image &&
                selectedVehicle.image.trim() !== "" ? (
                  <img
                    src={selectedVehicle.image}
                    alt={selectedVehicle.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-steel">
                    <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100">
                      <Car size={20} className="text-amber-400" />
                    </div>
                    <span className="text-[11px]">No image provided</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 rounded-lg border border-line bg-paper/50 p-3">
                <h3 className="text-[13px] font-semibold text-ink">
                  {selectedVehicle.name}
                </h3>
                <p className="text-[12px] text-steel">
                  Unit Details:{" "}
                  <span className="font-medium text-ink">
                    {selectedVehicle.unit_name ||
                      selectedVehicle.capacity ||
                      "—"}
                  </span>
                </p>
                {selectedVehicle.description && selectedVehicle.description !== "N/A" && (
                  <p className="line-clamp-2 text-[11.5px] leading-relaxed text-steel">
                    {selectedVehicle.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <MapPin size={13} className="text-brand" /> Destination
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Downtown Office"
                    value={formData.destination}
                    onChange={(e) => update("destination", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">
                    Purpose
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Client meeting"
                    value={formData.purpose}
                    onChange={(e) => update("purpose", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => update("priority", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>
            </div>
            {/* RIGHT: calendar + form */}
            <div className="md:col-span-7 space-y-3.5">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                  <CalendarIcon size={14} className="text-brand" /> Select Date
                  Range & Time
                </label>
                {renderCalendarGrid()}
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-line bg-paper p-2 text-[11px]">
                  <div>
                    <span className="mb-0.5 block text-steel">Start:</span>
                    <span className="block font-semibold text-ink">
                      {formData.start_date || "Select start"}
                    </span>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => update("start_time", e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-white px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <span className="mb-0.5 block text-steel">End:</span>
                    <span className="block font-semibold text-ink">
                      {formData.end_date || "Select end"}
                    </span>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => update("end_time", e.target.value)}
                      className="mt-1 w-full rounded border border-line bg-white px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                      <User size={13} className="text-brand" /> First Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Juan"
                      value={formData.first_name}
                      onChange={(e) => update("first_name", e.target.value)}
                      className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      placeholder="M (initial)"
                      value={formData.middle_name}
                      onChange={(e) => update("middle_name", e.target.value)}
                      className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-ink">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Cruz"
                      value={formData.last_name}
                      onChange={(e) => update("last_name", e.target.value)}
                      className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <Phone size={13} className="text-brand" /> Cell Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={11}
                    placeholder="09123456789"
                    value={formData.cell_number}
                    onChange={(e) => {
                      const value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);
                      update("cell_number", value);
                    }}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <Mail size={13} className="text-brand" /> Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g., juan.cruz@example.com"
                    value={formData.email || ""}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <Home size={13} className="text-brand" /> Address
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123 Street Name, City"
                    value={formData.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
                </div>
              </div>
              {/* Attendees */}
            </div>
          </div>
          {/* Close grid, open fixed footer */}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-white z-10">
            {conflict && (
              <div className="mr-auto mb-2 w-full sm:mb-0 sm:w-auto sm:max-w-[70%]">
                <div className="rounded-lg border border-status-rejected/30 bg-status-rejected/5 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-status-rejected">
                    <Clock size={13} />
                    Resource Unavailable
                  </p>
                  <p className="mt-0.5 text-[11px] text-steel">
                    An approved request holds this resource from{" "}
                    <span className="font-medium text-ink">{conflict.start_date}</span> to{" "}
                    <span className="font-medium text-ink">{conflict.end_date}</span>
                    {conflict.start_time && conflict.end_time && (
                      <span className="block">
                        ({formatSlotLabel(conflict.start_time, conflict.end_time)})
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-steel">
                    A 30-minute buffer is enforced after each booking for
                    turnaround and preparation.
                  </p>
                  {(conflict.purpose || conflict.full_name) && (
                    <p className="mt-0.5 text-[10.5px] text-steel">
                      {conflict.full_name && <span>Booked by: {conflict.full_name}</span>}
                      {conflict.purpose && (
                        <span className="block">Purpose: {conflict.purpose}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
            {suggestedSlots.length > 0 && (
              <div className="mr-auto mb-2 w-full sm:mb-0 sm:w-auto sm:max-w-[70%]">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink">
                  <Sparkles size={12} className="text-brand" />
                  Suggested {suggestedSlots.length === 1 ? "available time" : "available times"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applySlot(slot)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-ink transition-all hover:border-brand hover:bg-brand/5 hover:text-brand"
                    >
                      {formatSlotLabel(slot.start_time, slot.end_time)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loadingSlots && (
              <div className="mr-auto mb-2 w-full sm:mb-0 sm:w-auto sm:max-w-[70%]">
                <p className="text-[11px] text-steel">Checking availability...</p>
              </div>
            )}
            {submitError && (
              <div className="mr-auto mb-2 w-full sm:mb-0 sm:w-auto sm:max-w-[70%]">
                <div className="rounded-lg border border-rose-200/50 bg-rose-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-rose-700">
                    <Clock size={13} />
                    {submitError}
                  </p>
                  {submitAlternatives.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10.5px] font-medium text-rose-600">Alternative resources available:</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {submitAlternatives.map((alt) => (
                          <span
                            key={alt.resource_id || alt.id}
                            className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800"
                          >
                            {alt.name || alt.resource_name || "Resource"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-1.5 text-[13px] text-steel hover:bg-paper">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-md bg-brand px-4 py-1.5 text-[12px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Submitting...
                </>
              ) : isDirectUse ? (
                "Allocate"
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
