import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Grid,
} from "lucide-react";
import * as api from "../api/endpoints";

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

// Size of a booking block in the week view
function blockBox(b) {
  const startMins = timeToMinutes(
    formatTimeTo12Hour(b.start_time || b.time || "02:00"),
  );
  const endMins = timeToMinutes(formatTimeTo12Hour(b.end_time || "17:00"));
  const top = Math.max(0, ((startMins - 60) / 60) * 64);
  const height = Math.max(75, Math.max(0.5, (endMins - startMins) / 60) * 64);
  return { top, height };
}

// Put overlapping bookings side by side instead of stacking them
function layoutOverlaps(items) {
  const sorted = [...items].sort(
    (a, c) => a.top - c.top || c.height - c.height,
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
  const [bookings, setBookings] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 22));
  const [loading, setLoading] = useState(true);
  const [isYearView, setIsYearView] = useState(false);

  useEffect(() => {
    const loadBookings = () => {
      api
        .fetchBookings?.()
        .then((res) => {
          const data = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
          setBookings(data);
        })
        .catch((err) => {
          console.error("Failed to fetch bookings for calendar:", err);
          setBookings([]);
        })
        .finally(() => setLoading(false));
    };

    loadBookings();

    window.addEventListener("bookingUpdated", loadBookings);
    window.addEventListener("bookingDeleted", loadBookings);
    window.addEventListener("bookingChanged", loadBookings);

    return () => {
      window.removeEventListener("bookingUpdated", loadBookings);
      window.removeEventListener("bookingDeleted", loadBookings);
      window.removeEventListener("bookingChanged", loadBookings);
    };
  }, []);

  const weekDays = getWeekDays(currentDate);
  const monthDays = getMonthDays(currentDate);
  const currentYear = currentDate.getFullYear();

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
    setCurrentDate(new Date(2026, 8, 22));
  };

  const timeSlots = [
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
      {/* Mobile Stream Container Card */}
      <div className="flex flex-col w-full max-w-5xl mx-auto bg-white rounded-lg border border-line shadow-sm overflow-hidden">
        {/* Top Header Controls */}
        <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 border-b border-line bg-white shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <h1 className="text-[15px] sm:text-[17px] font-semibold text-ink">
              {isYearView ? `Yearly Overview (${currentYear})` : monthYearLabel}
            </h1>
            {isYearView ? (
              <div className="flex items-center gap-1 border border-line rounded-lg overflow-hidden bg-paper/50">
                <button
                  onClick={handlePrevYear}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Previous Year">
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-line/50 transition border-x border-line">
                  This Year
                </button>
                <button
                  onClick={handleNextYear}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Next Year">
                  <ChevronRight size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 border border-line rounded-lg overflow-hidden bg-paper/50">
                <button
                  onClick={handlePrevWeek}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Previous Week">
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-line/50 transition border-x border-line">
                  Today
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Next Week">
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
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

        {/* Conditional View: Year View vs Weekly Schedule View */}
        {isYearView ? (
          <div className="p-4 sm:p-6 bg-paper/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, mIndex) => {
                const monthDate = new Date(currentYear, mIndex, 1);
                const monthName = monthDate.toLocaleDateString("en-US", {
                  month: "long",
                });
                const mDays = getMonthDays(monthDate);

                return (
                  <div
                    key={mIndex}
                    className="bg-white border border-line rounded-xl p-3 shadow-sm">
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

                          const bDate = b.date || b.start_date || "";
                          return bDate.includes(item.fullDateStr);
                        });

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
                            {item.isCurrentMonth &&
                              (hasApproved || hasPending) && (
                                <div className="flex items-center gap-0.5 absolute bottom-0.5">
                                  {hasApproved && (
                                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                  )}
                                  {hasPending && (
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
          /* Calendar Grid Container with Horizontal Scroll for Small Screens */
          <div className="bg-white overflow-x-auto w-full relative">
            <div className="min-w-[750px] flex flex-col">
              {/* Days Header Row */}
              <div
                className="grid border-b border-line bg-paper/40 text-center sticky top-0 z-20"
                style={{
                  gridTemplateColumns: "70px repeat(7, minmax(0, 1fr))",
                }}>
                <div className="py-2.5 text-[11px] font-medium text-steel border-r border-line bg-paper sticky left-0 z-30">
                  GMT+08
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 border-r border-line last:border-r-0 flex flex-col items-center bg-paper">
                    <span className="text-[10px] font-semibold text-steel tracking-wider">
                      {day.name}
                    </span>
                    <span
                      className={`text-[14px] font-bold mt-0.5 h-6 w-6 flex items-center justify-center rounded-full ${day.isToday ? "bg-brand text-white" : "text-ink"}`}>
                      {day.dateNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* Time Grid Content */}
              <div
                className="grid relative max-h-[500px] overflow-y-scroll"
                style={{
                  gridTemplateColumns: "70px repeat(7, minmax(0, 1fr))",
                }}>
                {/* Time Column */}
                <div className="border-r border-line bg-paper/25 sticky left-0 z-10">
                  {timeSlots.map((time, idx) => (
                    <div
                      key={idx}
                      className="h-8 border-b border-line px-1 text-right text-[10px] font-mono text-steel pt-1 bg-white">
                      {time}
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns */}
                {weekDays.map((day, colIdx) => {
                  const colBookings = bookings.filter((b) => {
                    const status = (b.status || "").toLowerCase();
                    const isApproved = status.includes("approv");
                    const isPending =
                      status.includes("pend") ||
                      status.includes("request") ||
                      status.includes("tentative");

                    if (!isApproved && !isPending) return false;

                    const bDate = b.date || b.start_date || "";
                    return bDate.includes(day.fullDateStr);
                  });

                  const laidOut = layoutOverlaps(
                    colBookings.map((b) => ({ b, ...blockBox(b) })),
                  );

                  return (
                    <div
                      key={colIdx}
                      className="border-r border-line last:border-r-0 relative min-h-[1120px]">
                      {timeSlots.map((_, tIdx) => (
                        <div
                          key={tIdx}
                          className="h-8 border-b border-line w-full"
                        />
                      ))}

                      {laidOut.map(({ b, top, height, col, cols }) => {
                        const status = (b.status || "").toLowerCase();
                        const isApproved = status.includes("approv");

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
                        const barangayName = b.barangay || b.address || "";

                        const rawStart = b.start_time || b.time || "07:00";
                        const rawEnd = b.end_time || "17:00";

                        const startTime = formatTimeTo12Hour(rawStart);
                        const endTime = formatTimeTo12Hour(rawEnd);

                        return (
                          <div
                            key={b.id || b.booking_id}
                            title={`${resourceName} - ${b.status || ""} - ${requesterName}`}
                            className={`absolute ${cols > 1 ? "p-1" : "p-1.5"} hover:z-10 rounded-lg shadow-sm text-xs flex flex-col justify-between overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                              isApproved
                                ? "bg-emerald-500 text-white border border-emerald-600"
                                : "bg-amber-50 border-2 border-dashed border-amber-400 text-amber-900"
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(${(col / cols) * 100}% + 2px)`,
                              width: `calc(${100 / cols}% - 4px)`,
                            }}>
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="font-bold text-[11px] leading-tight break-all">
                                  {resourceName}
                                </span>
                                <span
                                  className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                                    isApproved
                                      ? "bg-emerald-700/80 text-white"
                                      : "bg-amber-200 text-amber-800"
                                  }`}>
                                  {b.status ||
                                    (isApproved ? "Approved" : "Pending")}
                                </span>
                              </div>

                              <div className="text-[10px] opacity-95 flex items-center gap-1 font-medium">
                                <Clock size={9} className="shrink-0" />
                                <span>
                                  {startTime} - {endTime}
                                </span>
                              </div>
                            </div>

                            <div
                              className={`text-[9.5px] font-medium opacity-95 pt-0.5 mt-0.5 border-t leading-tight break-words ${
                                isApproved
                                  ? "border-emerald-400/40"
                                  : "border-amber-300/60"
                              }`}>
                              👤 {requesterName}{" "}
                              {barangayName ? `• ${barangayName}` : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mini Calendar & Legend Section Stacked Underneath */}
      <div className="w-full max-w-5xl mx-auto bg-white border border-line rounded-lg p-4 mt-3 shadow-sm">
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

        <div className="max-w-xs mx-auto">
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

                const bDate = b.date || b.start_date || "";
                return bDate.includes(item.fullDateStr);
              });

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
                  {item.isCurrentMonth && (hasApproved || hasPending) && (
                    <div className="flex items-center gap-0.5 absolute bottom-0.5">
                      {hasApproved && (
                        <span
                          className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`}
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

        <div className="max-w-xs mx-auto">
          <h4 className="text-[11px] font-semibold text-steel uppercase tracking-wider mb-2">
            Legend & Status
          </h4>
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-ink font-medium">Approved Bookings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-dashed border-amber-600 shrink-0" />
              <span className="text-ink font-medium">Pending Requests</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
