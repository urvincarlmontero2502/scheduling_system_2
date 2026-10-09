import { useEffect, useState } from "react";
import * as api from "../api/endpoints";
import {
  X,
  Calendar as CalendarIcon,
  MapPin,
  User,
  Phone,
  Home,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

// Helper: robustly extract date parts from various formats
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  // Handle ISO datetime: 2026-10-15T08:00:00
  const datePart = String(dateStr).split("T")[0];
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return { y, m, d };
};

// Helper: match booking to resource ID
const isMatch = (booking, resourceId) => {
  // Try multiple possible field names for resource ID
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
    full_name: "",
    cell_number: "",
    address: "",
  });
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState([]);

  // Load bookings so the calendar can show pending / approved days
  useEffect(() => {
    if (!isOpen) return;
    // Reset calendar to current month when modal opens
    setCurrentMonthDate(new Date());
    const load = () =>
      api
        .fetchBookings?.()
        .then((res) => {
          const fetchedBookings = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          console.log("📅 [VehicleBookingModal] Bookings fetched:", fetchedBookings.length);
          if (fetchedBookings.length > 0) {
            console.log("📅 [VehicleBookingModal] Sample booking:", fetchedBookings[0]);
            const resId = selectedVehicle?.resource_id || selectedVehicle?.id;
            console.log("📅 [VehicleBookingModal] Selected vehicle:", selectedVehicle);
            console.log("📅 [VehicleBookingModal] Resource ID:", resId, "Type:", typeof resId);
            console.log("📅 [VehicleBookingModal] Booking resource_id:", fetchedBookings[0]?.resource_id, "Type:", typeof fetchedBookings[0]?.resource_id);
            console.log("📅 [VehicleBookingModal] Booking status:", fetchedBookings[0]?.status);
            console.log("📅 [VehicleBookingModal] Booking start_date:", fetchedBookings[0]?.start_date);
            console.log("📅 [VehicleBookingModal] Total matching bookings:", fetchedBookings.filter(b => isMatch(b, resId)).length);
          }
          setBookings(fetchedBookings);
        })
        .catch((err) => {
          console.error("📅 [VehicleBookingModal] Failed to fetch bookings:", err);
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

  if (!isOpen || !selectedVehicle) return null;

  // Days of this resource that have approved / pending bookings
  const dayStatus = {};
  const resourceId = selectedVehicle.resource_id || selectedVehicle.id;
  console.log("📅 [VehicleBookingModal] Computing dayStatus for resourceId:", resourceId, "bookings count:", bookings.length);

  bookings.forEach((b, idx) => {
    const isApproved = isApprovedStatus(b.status);
    const isPending = isPendingStatus(b.status);
    if (!isApproved && !isPending) {
      console.log("📅 [VehicleBookingModal] Booking idx:", idx, "Status not recognized as approved/pending:", b.status);
      return;
    }

    const sameResource = isMatch(b, resourceId);
    if (!sameResource) {
      console.log("📅 [VehicleBookingModal] Booking idx:", idx, "Resource mismatch - b.resource_id:", b.resource_id, "b.item_id:", b.item_id, "expected:", resourceId, "b.resource:", b.resource, "selectedVehicle.name:", selectedVehicle.name);
      return;
    }

    const startParts = parseDate(b.start_date);
    const endParts = parseDate(b.end_date || b.start_date);
    if (!startParts || !endParts) {
      console.log("📅 [VehicleBookingModal] Booking idx:", idx, "Date parse failed - start_date:", b.start_date, "end_date:", b.end_date);
      return;
    }

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
  console.log("📅 [VehicleBookingModal] dayStatus computed:", dayStatus);

  // Approved bookings of this resource that overlap the chosen dates and times
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
          // Handle datetime format: extract date portion for comparison
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
          return Math.max(ns, bs) < Math.min(ne, be);
        })
      : null;

  const update = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

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
        "relative h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium transition cursor-pointer ";
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
      <div className="rounded-lg border border-line bg-white p-2.5 shadow-sm">
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

        <div className="mb-1 grid grid-cols-7 border-b border-line pb-1 text-center text-[10px] font-semibold text-steel">
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

        <div className="mt-2 flex items-center justify-center gap-4 border-t border-line pt-2 text-[10.5px] text-steel">
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
    formData.full_name.trim() &&
    formData.cell_number.length === 11 &&
    formData.address.trim() &&
    !conflict;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      item_id: selectedVehicle.resource_id || selectedVehicle.id,
      type: "vehicle",
      ...formData,
      status: isDirectUse ? "approved" : "pending",
    };
    Promise.resolve(onSubmit(payload)).finally(() => setSubmitting(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 p-4"
      onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
            {/* LEFT: image + details */}
            <div className="space-y-3">
              <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
                {selectedVehicle.image &&
                selectedVehicle.image.trim() !== "" ? (
                  <img
                    src={selectedVehicle.image}
                    alt={selectedVehicle.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-steel">
                    <ImageIcon size={22} />
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
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-steel">
                  {selectedVehicle.description ||
                    "No description provided for this resource."}
                </p>
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
              </div>
            </div>

            {/* RIGHT: calendar + form */}
            <div className="space-y-2.5">
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
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <User size={13} className="text-brand" /> Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                  />
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
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <Home size={13} className="text-brand" /> Where do you live
                  (Address)
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
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {conflict && (
              <p className="mr-auto basis-full text-[11.5px] font-medium text-status-rejected sm:basis-auto sm:max-w-[60%]">
                Already booked: an approved request holds this resource from{" "}
                {conflict.start_date} to {conflict.end_date}
                {conflict.time && conflict.time !== "All Day"
                  ? ` (${conflict.time})`
                  : ""}
                . Choose a different date or time.
              </p>
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
