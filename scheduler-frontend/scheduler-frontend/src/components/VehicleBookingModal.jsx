import { useEffect, useState } from "react";
import * as api from "../api/endpoints";
import { getTodayDateInManila } from "../utils/bookingDates";
import { getBookingResourceIds } from "../utils/bookingResources";
import {
  calculateHourlyRentalEstimate,
  dateTimeToMinutes,
  formatRentalDuration,
  formatResourcePrice,
  parseResourceInclusions,
} from "../utils/resourcePricing";
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
  CheckCircle2,
  Plus,
  Trash2,
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
  return getBookingResourceIds(booking).includes(String(resourceId));
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
  availableVehicles = [],
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [vehicleToAdd, setVehicleToAdd] = useState("");
  const minimumBookingDate = getTodayDateInManila();

  const resourceImages = selectedVehicle?.images?.length
    ? selectedVehicle.images
    : selectedVehicle?.image
      ? [selectedVehicle.image]
      : [];
  const vehicleInclusions = parseResourceInclusions(
    selectedVehicle?.inclusions,
  );
  const visibleImageIndex = Math.min(
    currentImageIndex,
    Math.max(resourceImages.length - 1, 0),
  );

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [isOpen, selectedVehicle?.resource_id, selectedVehicle?.id]);

  useEffect(() => {
    if (!isOpen || !selectedVehicle) return;
    setSelectedVehicles([selectedVehicle]);
    setShowVehiclePicker(false);
    setVehicleToAdd("");
  }, [isOpen, selectedVehicle?.resource_id, selectedVehicle?.id]);

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

  const vehiclesInRequest = selectedVehicles.length
    ? selectedVehicles
    : [selectedVehicle];
  const selectedVehicleIds = vehiclesInRequest.map(
    (vehicle) => vehicle.resource_id || vehicle.id,
  );
  const resourceId = selectedVehicle.resource_id || selectedVehicle.id;

  // Days occupied by any selected vehicle.
  const dayStatus = {};

  bookings.forEach((b) => {
    const isApproved = isApprovedStatus(b.status);
    const isPending = isPendingStatus(b.status);
    if (!isApproved && !isPending) return;

    if (!selectedVehicleIds.some((id) => isMatch(b, id))) return;

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

  const requestedStart = dateTimeToMinutes(
    formData.start_date,
    formData.start_time,
  );
  const requestedEnd = dateTimeToMinutes(
    formData.end_date,
    formData.end_time,
    true,
  );
  const rentalEstimate = calculateHourlyRentalEstimate(
    requestedStart,
    requestedEnd,
    selectedVehicle.price_per_hour,
  );
  const vehicleEstimates = vehiclesInRequest.map((vehicle) => ({
    vehicle,
    estimate: calculateHourlyRentalEstimate(
      requestedStart,
      requestedEnd,
      vehicle.price_per_hour,
    ),
  }));
  const totalEstimate =
    vehicleEstimates.length > 0 &&
    vehicleEstimates.every(({ estimate }) => Number.isFinite(estimate?.total))
      ? vehicleEstimates.reduce((total, { estimate }) => total + estimate.total, 0)
      : null;
  const bookingDurationLabel = rentalEstimate
    ? formatRentalDuration(rentalEstimate.durationMinutes)
    : null;
  const findVehicleConflict = (vehicle) => {
    if (
      !formData.start_date ||
      !formData.end_date ||
      requestedStart === null ||
      requestedEnd === null
    ) {
      return null;
    }

    const bufferMinutes = Math.max(0, Number(vehicle.buffer_minutes ?? 30));
    const vehicleId = vehicle.resource_id || vehicle.id;
    return bookings.find((booking) => {
      if (!isApprovedStatus(booking.status) && !isPendingStatus(booking.status)) {
        return false;
      }
      if (!isMatch(booking, vehicleId)) return false;

      const bookingStart = dateTimeToMinutes(booking.start_date, booking.start_time);
      const bookingEnd = dateTimeToMinutes(
        booking.end_date || booking.start_date,
        booking.end_time,
        true,
      );
      if ([bookingStart, bookingEnd].some((value) => value === null)) return true;

      return (
        Math.max(requestedStart, bookingStart - bufferMinutes) <
        Math.min(requestedEnd, bookingEnd + bufferMinutes)
      );
    });
  };
  const vehicleConflicts = vehiclesInRequest
    .map((vehicle) => ({
      vehicle,
      booking: findVehicleConflict(vehicle),
    }))
    .filter(({ booking }) => booking);

  const availableVehiclesForSelection = availableVehicles.filter((vehicle) => {
    const vehicleId = vehicle.resource_id || vehicle.id;
    return (
      vehicleId != null &&
      vehicle.type?.toLowerCase() === "vehicle" &&
      String(vehicle.status || "").toLowerCase() !== "maintenance" &&
      !selectedVehicleIds.some((id) => String(id) === String(vehicleId)) &&
      !findVehicleConflict(vehicle)
    );
  });

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
    if (dateString < minimumBookingDate) return;

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
      const isPastDate = dateString < minimumBookingDate;

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
          disabled={isPastDate}
          onClick={() => handleDateClick(dateString)}
          className={`${cellStyles}${isPastDate ? " cursor-not-allowed text-slate-300 hover:bg-transparent" : ""}`}>
          {day}
          {st && (
            <span className="absolute bottom-[1px] left-1/2 flex -translate-x-1/2 items-center gap-0.5">
              {st.approved && (
                <span className="h-1 w-1 rounded-full bg-blue-500 ring-1 ring-white" />
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
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{" "}
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
    formData.start_date >= minimumBookingDate &&
    formData.end_date &&
    formData.end_date >= minimumBookingDate &&
    rentalEstimate &&
    formData.purpose.trim() &&
    (formData.first_name.trim() || formData.last_name.trim()) &&
    formData.cell_number.length === 11 &&
    formData.email &&
    formData.address.trim() &&
    vehicleConflicts.length === 0;

  const handleAddVehicle = (id) => {
    const vehicle = availableVehiclesForSelection.find(
      (item) => String(item.resource_id || item.id) === String(id),
    );
    if (!vehicle) return;

    setSelectedVehicles((current) => [...current, vehicle]);
    setVehicleToAdd("");
    setShowVehiclePicker(false);
  };

  const handleRemoveVehicle = (id) => {
    setSelectedVehicles((current) =>
      current.filter(
        (vehicle) =>
          String(vehicle.resource_id || vehicle.id) !== String(id),
      ),
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitAlternatives([]);

    const payload = {
      item_id: selectedVehicle.resource_id || selectedVehicle.id,
      resource_ids: selectedVehicleIds,
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
              <div className="relative flex h-40 sm:h-56 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-100">
                {resourceImages.length > 0 ? (
                  <img
                    src={resourceImages[visibleImageIndex]}
                    alt={`${selectedVehicle.name} photo ${visibleImageIndex + 1}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-steel">
                    <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-100">
                      <Car size={20} className="text-amber-400" />
                    </div>
                    <span className="text-[11px]">No image provided</span>
                  </div>
                )}
                {resourceImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous resource photo"
                      onClick={() =>
                        setCurrentImageIndex(
                          (visibleImageIndex - 1 + resourceImages.length) %
                            resourceImages.length,
                        )
                      }
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next resource photo"
                      onClick={() =>
                        setCurrentImageIndex(
                          (visibleImageIndex + 1) % resourceImages.length,
                        )
                      }
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
                      <ChevronRight size={18} />
                    </button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      {visibleImageIndex + 1} / {resourceImages.length}
                    </span>
                  </>
                )}
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Hourly Rates
                </p>
                <div className="mt-1 space-y-0.5 text-[11px] text-blue-900">
                  {vehicleEstimates.map(({ vehicle }) => (
                    <p key={vehicle.resource_id || vehicle.id}>
                      {vehicle.name}:{" "}
                      <strong>{formatResourcePrice(vehicle.price_per_hour)}</strong> / hour
                    </p>
                  ))}
                </div>
                <div className="mt-2 border-t border-blue-100 pt-2 text-[11px] text-blue-900">
                  {rentalEstimate ? (
                    <>
                      <p>
                        Duration:{" "}
                        <span className="font-semibold">
                          {bookingDurationLabel}
                        </span>
                      </p>
                      <p>
                        Billable hours:{" "}
                        <span className="font-semibold">
                          {rentalEstimate.billableHours}
                        </span>
                        {" "}
                        <span className="text-blue-700">
                          (partial hours round up)
                        </span>
                      </p>
                      <p className="mt-1 flex items-center justify-between border-t border-blue-100 pt-1.5 text-[12px]">
                        <span className="font-semibold">Estimated total</span>
                        <span className="text-sm font-bold">
                          {totalEstimate === null
                            ? "For assessment"
                            : formatResourcePrice(totalEstimate)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p>Select a valid date and time range to estimate the total.</p>
                  )}
                </div>
              </div>
              {vehicleInclusions.length > 0 && (
                <div className="rounded-lg border border-line bg-white p-3">
                  <h3 className="mb-2 text-[12px] font-semibold text-ink">
                    What's Included
                  </h3>
                  <ul className="space-y-1.5">
                    {vehicleInclusions.map((inclusion, index) => (
                      <li
                        key={`${inclusion}-${index}`}
                        className="flex items-start gap-2 text-[11.5px] text-steel">
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                        <span>{inclusion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2 rounded-lg border border-line bg-paper/50 p-3">
                <h3 className="text-[13px] font-semibold text-ink">Selected Vehicles</h3>
                <ul className="space-y-1.5">
                  {vehiclesInRequest.map((vehicle, index) => {
                    const vehicleId = vehicle.resource_id || vehicle.id;
                    return (
                      <li
                        key={vehicleId}
                        className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-2.5 py-2 text-[12px]"
                      >
                        <span className="min-w-0 truncate font-medium text-ink">
                          {vehicle.name}
                          {index === 0 && (
                            <span className="ml-1.5 text-[10px] font-normal text-steel">
                              Primary
                            </span>
                          )}
                        </span>
                        {index > 0 && (
                          <button
                            type="button"
                            aria-label={`Remove ${vehicle.name}`}
                            onClick={() => handleRemoveVehicle(vehicleId)}
                            className="flex shrink-0 items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800"
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={
                    !formData.start_date ||
                    !formData.end_date ||
                    !formData.start_time ||
                    !formData.end_time ||
                    !rentalEstimate ||
                    availableVehiclesForSelection.length === 0
                  }
                  onClick={() => setShowVehiclePicker((visible) => !visible)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-white px-3 py-2 text-[11.5px] font-semibold text-brand transition hover:border-brand hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Another Vehicle
                </button>
                {showVehiclePicker && (
                  <select
                    autoFocus
                    value={vehicleToAdd}
                    onChange={(event) => handleAddVehicle(event.target.value)}
                    className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-[11.5px] outline-none focus:border-brand"
                    aria-label="Select an available utility vehicle"
                  >
                    <option value="">Select an available vehicle</option>
                    {availableVehiclesForSelection.map((vehicle) => (
                      <option
                        key={vehicle.resource_id || vehicle.id}
                        value={vehicle.resource_id || vehicle.id}
                      >
                        {vehicle.name}
                      </option>
                    ))}
                  </select>
                )}
                {!formData.start_date || !formData.end_date ? (
                  <p className="text-[10.5px] text-steel">
                    Choose a date and time to see available vehicles.
                  </p>
                ) : availableVehiclesForSelection.length === 0 ? (
                  <p className="text-[10.5px] text-steel">
                    No other vehicles are available for this schedule.
                  </p>
                ) : null}
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
                <p className="mt-1 text-[10.5px] text-steel">
                  Past dates are unavailable. Select today or a future date.
                </p>
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
                {formData.start_date &&
                  formData.end_date &&
                  !rentalEstimate && (
                    <p className="mt-1 text-[10.5px] text-rose-600">
                      The end date and time must be after the start date and time.
                    </p>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-ink">
                      <User size={13} className="text-brand" />
                      <span className="whitespace-nowrap">
                        First Name <span className="text-red-500">*</span>
                      </span>
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
                      Last Name <span className="text-red-500">*</span>
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
                  <label className="mb-1 flex items-center gap-1 text-[12px] font-medium text-ink">
                    <Phone size={13} className="text-brand" />
                    <span className="whitespace-nowrap">
                      Cell Number <span className="text-red-500">*</span>
                    </span>
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
                    <Home size={13} className="text-brand" />
                    <span className="whitespace-nowrap">
                      Address <span className="text-red-500">*</span>
                    </span>
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
            {vehicleConflicts.length > 0 && (
              <div className="mr-auto mb-2 w-full sm:mb-0 sm:w-auto sm:max-w-[70%]">
                <div className="rounded-lg border border-status-rejected/30 bg-status-rejected/5 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-status-rejected">
                    <Clock size={13} />
                    {vehicleConflicts.length === 1
                      ? "Vehicle Unavailable"
                      : "Vehicles Unavailable"}
                  </p>
                  <ul className="mt-1 space-y-1 text-[11px] text-steel">
                    {vehicleConflicts.map(({ vehicle, booking }) => (
                      <li key={vehicle.resource_id || vehicle.id}>
                        <strong className="text-ink">{vehicle.name}</strong> has an
                        overlapping reservation from{" "}
                        <span className="font-medium text-ink">{booking.start_date}</span>
                        {" "}to{" "}
                        <span className="font-medium text-ink">{booking.end_date}</span>
                        {booking.start_time && booking.end_time
                          ? ` (${formatSlotLabel(booking.start_time, booking.end_time)})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10.5px] text-steel">
                    Each vehicle's configured turnaround buffer is enforced.
                  </p>
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
