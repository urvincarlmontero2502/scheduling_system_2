import { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Grid,
  Filter,
  Star,
  Sparkles,
} from "lucide-react";
import * as api from "../api/endpoints";
import { useCachedData } from "../hooks/useCachedData";
import { useTabUrlSync } from "../hooks/useTabUrlSync";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import BookingDetailModal from "../components/BookingDetailModal";
import { invalidateCache, CACHE_KEYS } from "../utils/cache";
import {
  isRecurringSpecialEventDate,
  isSpecialEvent,
} from "../utils/specialEvents";

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
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const clean = timeStr.toUpperCase();
  let [timePart, modifier] = clean.split(" ");
  let [hours, minutes] = timePart.split(":").map(Number);

  if (isNaN(hours)) return 0;
  if (!minutes) minutes = 0;

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Helper to get local YYYY-MM-DD string without UTC timezone shift
function getLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDays(date) {
  const current = new Date(date);
  const day = current.getDay();
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - day);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push({
      name: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dateNum: d.getDate(),
      fullDateStr: getLocalDateString(d),
      isToday: d.toDateString() === new Date().toDateString(),
    });
  }
  return days;
}

// Size of a booking block matching the 28px per 30 mins grid
function blockBox(b) {
  const startMins = timeToMinutes(
    formatTimeTo12Hour(b.start_time || b.time || "07:00"),
  );
  const endMins = timeToMinutes(formatTimeTo12Hour(b.end_time || "17:00"));
  // 28px per 30 mins = 56px per hour
  const top = Math.max(0, (startMins / 60) * 56);
  const height = Math.max(56, Math.max(0.5, (endMins - startMins) / 60) * 56);
  return { top, height };
}

// Put overlapping bookings side by side instead of stacking them
function layoutOverlaps(items) {
  const sorted = [...items].sort(
    (a, c) => a.top - c.top || c.height - a.height,
  );
  const result = [];
  let cluster = [];
  let clusterEnd = -1;

  const isApprovedItem = (it) =>
    (it.b.status || "").toLowerCase().includes("approv");

  const flush = () => {
    if (!cluster.length) return;
    const ordered = [...cluster].sort(
      (a, c) =>
        Number(isApprovedItem(c)) - Number(isApprovedItem(a)) || a.top - c.top,
    );
    const columns = [];
    ordered.forEach((it) => {
      let col = columns.findIndex((items) =>
        items.every(
          (x) => it.top >= x.top + x.height || it.top + it.height <= x.top,
        ),
      );
      if (col === -1) {
        col = columns.length;
        columns.push([]);
      }
      columns[col].push(it);
      it.col = col;
    });
    cluster.forEach((it) => {
      it.cols = columns.length;
      result.push(it);
    });
    cluster = [];
  };

  sorted.forEach((it) => {
    if (cluster.length && it.top >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.top + it.height);
  });
  flush();
  return result;
}

// API `date` is "YYYY-MM-DD to YYYY-MM-DD", which does not cover the
// days in between. Match the real start/end columns instead.
function bookingOnDate(booking, fullDateStr) {
  const start = String(booking.start_date || "").slice(0, 10);
  const end = String(booking.end_date || start).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return fullDateStr >= start && fullDateStr <= end;
  }
  return String(booking.date || "").includes(fullDateStr);
}

function getMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();

  const days = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevLastDay - i);
    days.push({
      dayNum: prevLastDay - i,
      isCurrentMonth: false,
      fullDateStr: getLocalDateString(d),
    });
  }

  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(year, month, i);
    days.push({
      dayNum: i,
      isCurrentMonth: true,
      fullDate: d,
      fullDateStr: getLocalDateString(d),
    });
  }

  const totalCells = days.length <= 35 ? 35 : 42;
  const nextDaysCount = totalCells - days.length;
  for (let i = 1; i <= nextDaysCount; i++) {
    const d = new Date(year, month + 1, i);
    days.push({
      dayNum: i,
      isCurrentMonth: false,
      fullDateStr: getLocalDateString(d),
    });
  }

  return days;
}

export default function CalendarView() {
  // Cached data hooks — data persists across page switches
    const { user } = useAuth();
    const toast = useToast();
  const { data: bookings, loading } = useCachedData("bookings", api.fetchBookings);
    const { data: resources } = useCachedData("resources", api.fetchResources);
  const [selectedBooking, setSelectedBooking] = useState(null);

    // Extract and group special events from bookings
        const specialEventsGrouped = useMemo(() => {
          const special = bookings.filter((b) => isSpecialEvent(b));
          const groups = {};

          special.forEach((b) => {
            const eventName = b.full_name || b.purpose || "Special Event";
            const dateStr = String(b.start_date || "").slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

            // Group by event name only (not by date)
            if (!groups[eventName]) {
              groups[eventName] = {
                name: eventName,
                dates: new Set(),
                resources: new Set(),
                purpose: b.purpose,
              };
            }
            groups[eventName].dates.add(dateStr);
            if (b.resource) groups[eventName].resources.add(b.resource);
            if (b.resource_name) groups[eventName].resources.add(b.resource_name);
            if (b.item_name) groups[eventName].resources.add(b.item_name);
          });

          return Object.values(groups).map((g) => {
            // Sort dates and find consecutive ranges
            const sortedDates = [...g.dates].sort();
            const dateRanges = [];
            let rangeStart = sortedDates[0];
            let rangeEnd = sortedDates[0];

            for (let i = 1; i < sortedDates.length; i++) {
              const prevDate = new Date(sortedDates[i - 1]);
              const currDate = new Date(sortedDates[i]);
              const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

              if (diffDays === 1) {
                // Consecutive date - extend the range
                rangeEnd = sortedDates[i];
              } else {
                // Non-consecutive - close current range and start new one
                dateRanges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`);
                rangeStart = sortedDates[i];
                rangeEnd = sortedDates[i];
              }
            }
            // Add the last range
            dateRanges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`);

            return {
              name: g.name,
              dateRanges: dateRanges,
              resources: Array.from(g.resources).sort(),
              purpose: g.purpose,
            };
          });
        }, [bookings]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isYearView, setIsYearView] = useState(false);
  const [yearViewFilter, setYearViewFilter] = useState("all");
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!isYearView && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 12 * 28;
    }
  }, [isYearView, currentDate]);

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);
  const currentYear = currentDate.getFullYear();
  const canModerate = user?.role === "admin";

  const handleBookingStatusChange = async (id, status, remarks) => {
    try {
      await api.updateBookingStatus(
        id,
        status,
        remarks ? { remarks } : {},
      );
      toast.success(
        `Booking ${status === "approved" ? "approved" : "rejected"} successfully`,
      );
      setSelectedBooking(null);
      invalidateCache(CACHE_KEYS.BOOKINGS);
      invalidateCache(CACHE_KEYS.HEALTH);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not update the booking status.",
      );
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handlePrevYear = () => {
    const prev = new Date(currentDate);
    prev.setFullYear(prev.getFullYear() - 1);
    setCurrentDate(prev);
  };

  const handleNextYear = () => {
    const next = new Date(currentDate);
    next.setFullYear(next.getFullYear() + 1);
    setCurrentDate(next);
  };

  const handlePrevMonth = () => {
    const prev = new Date(currentDate);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const timeSlots = [
    "1:00 AM",
    "1:30 AM",
    "2:00 AM",
    "2:30 AM",
    "3:00 AM",
    "3:30 AM",
    "4:00 AM",
    "4:30 AM",
    "5:00 AM",
    "5:30 AM",
    "6:00 AM",
    "6:30 AM",
    "7:00 AM",
    "7:30 AM",
    "8:00 AM",
    "8:30 AM",
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "12:30 PM",
    "1:00 PM",
    "1:30 PM",
    "2:00 PM",
    "2:30 PM",
    "3:00 PM",
    "3:30 PM",
    "4:00 PM",
    "4:30 PM",
    "5:00 PM",
    "5:30 PM",
    "6:00 PM",
    "6:30 PM",
    "7:00 PM",
    "7:30 PM",
    "8:00 PM",
    "8:30 PM",
    "9:00 PM",
    "9:30 PM",
    "10:00 PM",
    "10:30 PM",
    "11:00 PM",
    "11:30 PM",
    "12:00 AM",
  ];

  const monthYearLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex flex-col flex-1 w-full bg-white rounded-lg border border-line shadow-sm overflow-hidden">
          <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 border-b border-line bg-white shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <h1 className="text-[15px] sm:text-[17px] font-semibold text-ink">
                {isYearView
                  ? "Yearly Overview"
                  : monthYearLabel}
              </h1>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap">
              {isYearView ? (
                <div className="flex items-center border border-line rounded-lg overflow-hidden bg-paper/50">
                  <button
                    onClick={handlePrevYear}
                    className="p-1.5 hover:bg-line/50 text-steel transition"
                    title="Previous Year">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-3 py-1.5 text-[12px] sm:text-[13px] font-medium border-x border-line bg-paper text-ink">
                    {currentYear}
                  </span>
                  <button
                    onClick={handleNextYear}
                    className="p-1.5 hover:bg-line/50 text-steel transition"
                    title="Next Year">
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center border border-line rounded-lg overflow-hidden bg-paper/50">
                  <button
                    onClick={handlePrevWeek}
                    className="p-1.5 hover:bg-line/50 text-steel transition"
                    title="Previous Week">
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleToday}
                    className="px-3 py-1.5 text-[12px] sm:text-[13px] font-medium border-x border-line bg-paper hover:bg-line/50 text-ink transition">
                    Today
                  </button>
                  <button
                    onClick={handleNextWeek}
                    className="p-1.5 hover:bg-line/50 text-steel transition"
                    title="Next Week">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsYearView(!isYearView)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] sm:text-[13px] font-medium border border-line rounded-lg bg-paper hover:bg-line/50 text-ink transition">
                {isYearView ? (
                  <>
                    <CalendarIcon size={14} /> Back to Schedule
                  </>
                ) : (
                  <>
                    <Grid size={14} /> Year View
                  </>
                )}
              </button>
            </div>
          </header>

          {isYearView ? (
            <div className="p-4 sm:p-6 bg-paper/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 bg-white border border-line p-3 rounded-lg shadow-xs">
                <div className="flex items-center gap-2 text-[13px] font-medium text-steel">
                  <Filter size={15} />
                  <span>Filter Year View:</span>
                </div>
                <div className="flex items-center gap-1.5 bg-paper p-1 rounded-md border border-line">
                  <button
                    onClick={() => setYearViewFilter("all")}
                    className={`px-3 py-1 text-[12px] font-medium rounded transition ${
                      yearViewFilter === "all"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink hover:bg-line/50"
                    }`}>
                    All Bookings
                  </button>
                  <button
                    onClick={() => setYearViewFilter("approved")}
                    className={`px-3 py-1 text-[12px] font-medium rounded transition ${
                      yearViewFilter === "approved"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-ink hover:bg-line/50"
                    }`}>
                    Approved Only
                  </button>
                  <button
                    onClick={() => setYearViewFilter("pending")}
                    className={`px-3 py-1 text-[12px] font-medium rounded transition ${
                      yearViewFilter === "pending"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-ink hover:bg-line/50"
                    }`}>
                    Pending Only
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, mIndex) => {
                  const monthDate = new Date(currentYear, mIndex, 1);
                  const monthName = monthDate.toLocaleDateString("en-US", {
                    month: "long",
                  });
                  const mDays = getMonthDays(monthDate);

                  return (
                    <div
                      key={mIndex}
                      className="bg-white border border-line rounded-xl p-3 shadow-sm hover:shadow-md transition">
                      <h3 className="text-[13px] font-bold text-ink mb-2 text-center">
                        {monthName}
                      </h3>
                      <div className="grid grid-cols-7 text-center text-[10px] text-steel mb-1 font-semibold">
                        <span>S</span>
                        <span>M</span>
                        <span>T</span>
                        <span>W</span>
                        <span>T</span>
                        <span>F</span>
                        <span>S</span>
                      </div>
                      <div className="grid grid-cols-7 text-center text-[11px] gap-y-1">
                        {mDays.map((item, dIdx) => {
                                                  const dayBookings = bookings.filter((b) => {
                                                    const status = (b.status || "").toLowerCase();
                                                    const isApproved = status.includes("approv");
                                                    const isPending =
                                                      status.includes("pend") ||
                                                      status.includes("request") ||
                                                      status.includes("tentative");

                                                    if (!isApproved && !isPending) return false;

                                                    return bookingOnDate(b, item.fullDateStr);
                                                  });

                                                  const specialEventBookings = dayBookings.filter((b) => isSpecialEvent(b));
                                                  const regularBookings = dayBookings.filter((b) => !isSpecialEvent(b));

                                                  const hasApproved = dayBookings.some((b) =>
                                                    (b.status || "").toLowerCase().includes("approv"),
                                                  );
                                                  const hasPending = dayBookings.some((b) => {
                                                    const s = (b.status || "").toLowerCase();
                                                    return (
                                                      s.includes("pend") ||
                                                      s.includes("request") ||
                                                      s.includes("tentative")
                                                    );
                                                  });

                                                  const showApprovedIndicator =
                                                    (yearViewFilter === "all" ||
                                                      yearViewFilter === "approved") &&
                                                    hasApproved;
                                                  const showPendingIndicator =
                                                    (yearViewFilter === "all" ||
                                                      yearViewFilter === "pending") &&
                                                    hasPending;
                                                  const showSpecialEventIndicator =
                                                    (yearViewFilter === "all" ||
                                                      yearViewFilter === "approved") &&
                                                    (specialEventBookings.length > 0 ||
                                                      isRecurringSpecialEventDate(item.fullDateStr));
                                                  const hasVisibleIndicator =
                                                    showApprovedIndicator ||
                                                    showPendingIndicator ||
                                                    showSpecialEventIndicator;

                                                  return (
                                                    <div
                                                      key={dIdx}
                                                      onClick={() => {
                                                        if (item.isCurrentMonth && item.fullDate) {
                                                          setCurrentDate(new Date(item.fullDate));
                                                          setIsYearView(false);
                                                        }
                                                      }}
                                                      className={`h-7 w-7 mx-auto flex flex-col items-center justify-center rounded-full transition relative ${
                                                        item.isCurrentMonth
                                                          ? "cursor-pointer hover:bg-paper text-ink font-medium"
                                                          : "text-steel/30 cursor-default"
                                                      }`}>
                                                      <span>{item.dayNum}</span>
                                                      {item.isCurrentMonth && hasVisibleIndicator && (
                                                        <div className="flex items-center gap-0.5 absolute bottom-0.5">
                                                          {showSpecialEventIndicator && (
                                                            <span
                                                              className="h-1.5 w-1.5 rounded-full bg-purple-600"
                                                              title={
                                                                specialEventBookings.length > 0
                                                                  ? "Special event reservation"
                                                                  : "Recurring special event date; reservation not yet created"
                                                              }
                                                            />
                                                          )}
                                                          {showApprovedIndicator && regularBookings.some(b => (b.status || "").toLowerCase().includes("approv")) && (
                                                            <span className="h-1 w-1 rounded-full bg-blue-500" />
                                                          )}
                                                          {showPendingIndicator && (
                                                            <span className="h-1 w-1 rounded-full bg-amber-500" />
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white w-full relative overflow-hidden">
              <div
                ref={scrollContainerRef}
                className="grid relative max-h-[700px] overflow-y-auto w-full"
                style={{
                  gridTemplateColumns: "50px repeat(7, minmax(0, 1fr))",
                }}>
                <div className="py-2 text-[9px] sm:text-[10px] font-medium text-steel border-r border-b border-line bg-paper sticky top-0 z-30 flex items-center justify-center">
                  GMT
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 sm:py-2 border-r border-b border-line last:border-r-0 flex flex-col items-center bg-paper sticky top-0 z-30">
                    <span className="text-[8px] sm:text-[9px] font-semibold text-steel tracking-tight">
                      {day.name}
                    </span>
                    <span
                      className={`text-[11px] sm:text-[13px] font-bold mt-0.5 h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full ${day.isToday ? "bg-brand text-white" : "text-ink"}`}>
                      {day.dateNum}
                    </span>
                    {isRecurringSpecialEventDate(day.fullDateStr) && (
                      <span
                        className="h-1 w-1 rounded-full bg-purple-600 mt-0.5"
                        title="Recurring special event date; reservation not yet created"
                      />
                    )}
                  </div>
                ))}

                <div className="border-r border-line bg-paper/25 sticky left-0 z-20 flex flex-col">
                  {timeSlots.map((time, idx) => (
                    <div
                      key={idx}
                      className="h-[28px] border-b border-line px-0.5 text-right text-[8px] sm:text-[9px] font-mono text-steel pt-1 bg-white box-border">
                      {time}
                    </div>
                  ))}
                </div>

                {weekDays.map((day, colIdx) => {
                  const colBookings = bookings.filter((b) => {
                    const status = (b.status || "").toLowerCase();
                    const isApproved = status.includes("approv");
                    const isPending =
                      status.includes("pend") ||
                      status.includes("request") ||
                      status.includes("tentative");

                    if (!isApproved && !isPending) return false;

                    return bookingOnDate(b, day.fullDateStr);
                  });

                  const laidOut = layoutOverlaps(
                    colBookings.map((b) => ({ b, ...blockBox(b) })),
                  );

                  return (
                    <div
                      key={colIdx}
                      className="border-r border-line last:border-r-0 relative flex flex-col"
                      style={{ minHeight: `${timeSlots.length * 28}px` }}>
                      {timeSlots.map((_, tIdx) => (
                        <div
                          key={tIdx}
                          className="h-[28px] border-b border-line w-full box-border"
                        />
                      ))}

                      {laidOut.map(({ b, top, height, col, cols }) => {
                                              const status = (b.status || "").toLowerCase();
                                              const isApproved = status.includes("approv");
                                              const isSpecial = isSpecialEvent(b);

                                              const resourceName =
                                                b.resource ||
                                                b.resource_name ||
                                                b.item_name ||
                                                "Resource";
                                              const requesterName =
                                                b.requester ||
                                                b.full_name ||
                                                b.name ||
                                                b.user_name ||
                                                "Representative";

                                              const rawStart = b.start_time || b.time || "07:00";
                                              const rawEnd = b.end_time || "17:00";

                                              const startTime = formatTimeTo12Hour(rawStart);
                                              const endTime = formatTimeTo12Hour(rawEnd);

                                              return (
                                                <div
                                                  key={b.id || b.booking_id}
                                                  title={`${resourceName} - ${b.status || ""} - ${requesterName}${isSpecial ? " ⭐ Special Event" : ""}`}
                                                  role="button"
                                                  tabIndex={0}
                                                  aria-label={`View ${b.status || "booking"} for ${resourceName}, requested by ${requesterName}`}
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedBooking(b);
                                                  }}
                                                  onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                      event.preventDefault();
                                                      setSelectedBooking(b);
                                                    }
                                                  }}
                                                  className={`absolute p-0.5 sm:p-1 hover:z-10 rounded shadow-xs text-[9px] flex flex-col justify-between overflow-hidden transition-all cursor-pointer ${
                                                    isApproved
                                                      ? isSpecial
                                                        ? "bg-purple-600 text-white border border-purple-700"
                                                        : "bg-blue-500 text-white border border-blue-600"
                                                      : "bg-amber-50 border border-dashed border-amber-400 text-amber-900"
                                                  }`}
                                                  style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    left: `calc(${(col / cols) * 100}% + 1px)`,
                                                    width: `calc(${100 / cols}% - 2px)`,
                                                  }}>
                                                  <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between gap-0.5">
                                                      <span className="font-bold text-[9px] leading-tight truncate flex items-center gap-1">
                                                        {isSpecial && <Star className="h-3 w-3" />}
                                                        {resourceName}
                                                      </span>
                                                    </div>
                                                    <div className="text-[8px] opacity-90 truncate">
                                                      {startTime}
                                                    </div>
                                                  </div>
                                                  <div className="text-[7.5px] opacity-90 truncate flex items-center gap-1">
                                                    {isSpecial && <Star className="h-2.5 w-2.5" />}
                                                    {requesterName}
                                                  </div>
                                                </div>
                                              );
                                            })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Mini Calendar, Legend & Special Events Container */}
        <div className="w-full lg:w-[300px] shrink-0 bg-white border border-line rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-ink">
              {monthYearLabel}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-paper rounded text-steel transition"
                title="Previous Month">
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-paper rounded text-steel transition"
                title="Next Month">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <div className="w-full">
            <div className="grid grid-cols-7 text-center text-[11px] text-steel mb-1 font-medium">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] gap-y-1 mb-4 text-ink">
              {monthDays.map((item, i) => {
                              const isSelected =
                                item.isCurrentMonth && item.dayNum === currentDate.getDate();

                              const dayBookings = bookings.filter((b) => {
                                const status = (b.status || "").toLowerCase();
                                const isApproved = status.includes("approv");
                                const isPending =
                                  status.includes("pend") ||
                                  status.includes("request") ||
                                  status.includes("tentative");
                                if (!isApproved && !isPending) return false;

                                return bookingOnDate(b, item.fullDateStr);
                              });

                              const specialEventBookings = dayBookings.filter((b) => isSpecialEvent(b));
                              const regularBookings = dayBookings.filter((b) => !isSpecialEvent(b));
                              const hasRecurringSpecialEvent = isRecurringSpecialEventDate(item.fullDateStr);

                              const hasApproved = dayBookings.some((b) =>
                                (b.status || "").toLowerCase().includes("approv"),
                              );
                              const hasPending = dayBookings.some((b) => {
                                const s = (b.status || "").toLowerCase();
                                return (
                                  s.includes("pend") ||
                                  s.includes("request") ||
                                  s.includes("tentative")
                                );
                              });

                              return (
                                <div
                                  key={i}
                                  onClick={() => {
                                    if (item.isCurrentMonth && item.fullDate) {
                                      setCurrentDate(new Date(item.fullDate));
                                      setIsYearView(false);
                                    }
                                  }}
                                  className={`h-7 w-7 mx-auto flex flex-col items-center justify-center rounded-full transition relative ${
                                    item.isCurrentMonth
                                      ? "cursor-pointer hover:bg-paper"
                                      : "text-steel/30 cursor-default"
                                  } ${isSelected ? "bg-brand text-white font-bold" : ""}`}>
                                  <span>{item.dayNum}</span>
                                  {item.isCurrentMonth &&
                                    (hasApproved || hasPending || hasRecurringSpecialEvent) && (
                                    <div className="flex items-center gap-0.5 absolute bottom-0.5">
                                      {(specialEventBookings.length > 0 || hasRecurringSpecialEvent) && (
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-purple-300" : "bg-purple-600"}`}
                                          title={
                                            specialEventBookings.length > 0
                                              ? "Special event reservation"
                                              : "Recurring special event date; reservation not yet created"
                                          }
                                        />
                                      )}
                                      {hasApproved && regularBookings.some(b => (b.status || "").toLowerCase().includes("approv")) && (
                                        <span
                                          className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                                        />
                                      )}
                                      {hasPending && (
                                        <span
                                          className={`h-1 w-1 rounded-full ${isSelected ? "bg-amber-200" : "bg-amber-500"}`}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
            </div>
          </div>

          <hr className="border-line mb-3" />

                    {/* Legend & Status */}
                    <div className="w-full mb-4">
                      <h4 className="text-[11px] font-semibold text-steel uppercase tracking-wider mb-2">
                        Legend & Status
                      </h4>
                      <div className="space-y-2 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-ink font-medium">Approved Bookings</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-dashed border-amber-600 shrink-0" />
                          <span className="text-ink font-medium">Pending Requests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-purple-600 shrink-0 flex items-center justify-center">
                            <Star className="h-3 w-3 text-white" />
                          </span>
                          <span className="text-ink font-medium">Special Events (Approved)</span>
                        </div>
                      </div>
                    </div>

          <hr className="border-line mb-3" />

                    {/* Special Events List with Resources Used (Dynamic from Bookings) */}
                    <div className="w-full bg-purple-50/60 rounded-lg p-3 border border-purple-200/80">
                      <h4 className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Sparkles size={13} /> Special Events & Resources
                      </h4>
                      {specialEventsGrouped.length === 0 ? (
                                              <p className="text-[11px] text-purple-700 text-center py-2">
                                                No special events scheduled
                                              </p>
                                            ) : (
                                              <div className="max-h-[300px] overflow-y-auto space-y-3 text-[11px] text-purple-950 pr-1">
                                                {specialEventsGrouped.map((event, idx) => (
                                                  <div key={idx} className="border-b border-purple-200/60 pb-2 last:border-0 last:pb-0">
                                                    <div className="flex items-start gap-2">
                                                      <Star className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                                                      <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-purple-900 truncate">{event.name}</p>
                                                        {event.dateRanges.length > 0 && (
                                                          <p className="text-purple-700 text-[10px] mb-1">
                                                            {event.dateRanges.join(", ")}
                                                          </p>
                                                        )}
                                                        {event.resources.length > 0 && (
                                                          <p className="text-[10px] text-purple-900/80">
                                                            <span className="font-medium">Resources:</span>{" "}
                                                            {event.resources.join(", ")}
                                                          </p>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                    </div>
        </div>
      </div>
      {selectedBooking && (
        <BookingDetailModal
                    booking={selectedBooking}
                    canModerate={canModerate}
                    onClose={() => setSelectedBooking(null)}
                    onApprove={(id) => handleBookingStatusChange(id, "approved")}
                    onReject={(id, reason) =>
                      handleBookingStatusChange(id, "rejected", reason)
                    }
        />
      )}
    </div>
  );
}
