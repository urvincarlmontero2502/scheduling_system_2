import { useState } from "react";
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
} from "lucide-react";

export default function FacilityBookingModal({
  isOpen,
  onClose,
  onSubmit,
  selectedFacility,
}) {
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    start_time: "08:00",
    end_time: "17:00",
    purpose: "",
    full_name: "",
    cell_number: "",
    address: "",
  });
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !selectedFacility) return null;

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
        "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium transition cursor-pointer ";
      if (isStart || isEnd) {
        cellStyles += "bg-brand text-white font-bold shadow-sm";
      } else if (isInRange) {
        cellStyles += "bg-brand/10 text-brand-dark rounded-none";
      } else {
        cellStyles += "text-ink hover:bg-paper";
      }

      days.push(
        <button
          key={dateString}
          type="button"
          onClick={() => handleDateClick(dateString)}
          className={cellStyles}>
          {day}
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
      </div>
    );
  };

  const canSubmit =
    formData.start_date &&
    formData.end_date &&
    formData.purpose.trim() &&
    formData.full_name.trim() &&
    formData.cell_number.length === 11 &&
    formData.address.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    // Helper to format date strictly in local terms to prevent timezone shifting
    const formatLocalDate = (dateStr) => {
      if (!dateStr) return "";
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    };

    const payload = {
      item_id: selectedFacility.resource_id || selectedFacility.id,
      type: "facility",
      ...formData,
      start_date: formatLocalDate(formData.start_date),
      end_date: formatLocalDate(formData.end_date),
    };

    Promise.resolve(onSubmit(payload)).finally(() => setSubmitting(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              Request Booking: {selectedFacility.name}
            </h2>
            <p className="text-[11.5px] capitalize text-steel">
              Type: Facility
            </p>
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
                {selectedFacility.image &&
                selectedFacility.image.trim() !== "" ? (
                  <img
                    src={selectedFacility.image}
                    alt={selectedFacility.name}
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
                  {selectedFacility.name}
                </h3>
                <p className="text-[12px] text-steel">
                  Capacity:{" "}
                  <span className="font-medium text-ink">
                    {selectedFacility.capacity || "—"}
                  </span>
                </p>
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-steel">
                  {selectedFacility.description ||
                    "No description provided for this resource."}
                </p>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <MapPin size={13} className="text-brand" /> Purpose
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Quarterly Planning Meeting"
                  value={formData.purpose}
                  onChange={(e) => update("purpose", e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
                />
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

          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-1.5 text-[13px] text-steel hover:bg-paper">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-md bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
