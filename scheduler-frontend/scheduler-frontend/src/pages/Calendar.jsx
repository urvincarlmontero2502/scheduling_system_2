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

    // Listen to multiple event variants to ensure deletions/updates are caught immediately
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-white">
      {/* MAIN: Calendar Grid Area / Year View Area */}
      <div className="flex-1 flex flex-col border-r border-line">
        {/* Top Header Controls */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-[17px] font-semibold text-ink">
              {isYearView ? `Yearly Overview (${currentYear})` : monthYearLabel}
            </h1>
            {isYearView ? (
              <div className="flex items-center gap-1 border border-line rounded-lg overflow-hidden bg-paper/50">
                <button
                  onClick={handlePrevYear}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Previous Year">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-[13px] font-medium text-ink hover:bg-line/50 transition border-x border-line">
                  This Year
                </button>
                <button
                  onClick={handleNextYear}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Next Year">
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 border border-line rounded-lg overflow-hidden bg-paper/50">
                <button
                  onClick={handlePrevWeek}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Previous Week">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-[13px] font-medium text-ink hover:bg-line/50 transition border-x border-line">
                  Today
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 hover:bg-line/50 text-steel transition"
                  title="Next Week">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsYearView(!isYearView)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-line rounded-lg bg-paper hover:bg-line/50 text-ink transition">
              {isYearView ? (
                <>
                  <CalendarIcon size={15} /> Back to Schedule
                </>
              ) : (
                <>
                  <Grid size={15} /> Year View
                </>
              )}
            </button>
          </div>
        </header>

        {/* Conditional View: Year View vs Weekly Schedule View */}
        {isYearView ? (
          <div className="flex-1 p-6 overflow-y-auto bg-paper/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 12 }).map((_, mIndex) => {
                const monthDate = new Date(currentYear, mIndex, 1);
                const monthName = monthDate.toLocaleDateString("en-US", {
                  month: "long",
                });
                const mDays = getMonthDays(monthDate);

                return (
                  <div
                    key={mIndex}
                    className="bg-white border border-line rounded-xl p-4 shadow-sm">
                    <h3 className="text-[14px] font-bold text-ink mb-3 text-center">
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
          /* Scrollable Container */
          <div className="overflow-x-auto w-full">
            <div className="min-w-[800px] flex flex-col">
              {/* Days Header Row */}
              <div
                className="grid border-b border-line bg-paper/40 text-center sticky top-0 z-10"
                style={{
                  gridTemplateColumns: "75px repeat(7, minmax(0, 1fr))",
                }}>
                <div className="py-3 text-[11px] font-medium text-steel border-r border-line bg-paper">
                  GMT+08
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className="py-3 border-r border-line last:border-r-0 flex flex-col items-center bg-paper">
                    <span className="text-[11px] font-semibold text-steel tracking-wider">
                      {day.name}
                    </span>
                    <span
                      className={`text-[15px] font-bold mt-0.5 h-7 w-7 flex items-center justify-center rounded-full ${day.isToday ? "bg-brand text-white" : "text-ink"}`}>
                      {day.dateNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* Time Grid Content */}
              <div
                className="grid relative"
                style={{
                  gridTemplateColumns: "75px repeat(7, minmax(0, 1fr))",
                }}>
                {/* Time Column */}
                <div className="border-r border-line bg-paper/20">
                  {timeSlots.map((time, idx) => (
                    <div
                      key={idx}
                      className="h-8 border-b border-line px-2 text-right text-[11px] font-mono text-steel pt-1">
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

                  return (
                    <div
                      key={colIdx}
                      className="border-r border-line last:border-r-0 relative min-h-[1504px]">
                      {timeSlots.map((_, tIdx) => (
                        <div
                          key={tIdx}
                          className="h-8 border-b border-line w-full"
                        />
                      ))}

                      {colBookings.map((b) => {
                        const status = (b.status || "").toLowerCase();
                        const isApproved = status.includes("approv");
                        const isPending =
                          status.includes("pend") ||
                          status.includes("request") ||
                          status.includes("tentative");

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

                        const rawStart = b.start_time || b.time || "02:00";
                        const rawEnd = b.end_time || "17:00";

                        const startTime = formatTimeTo12Hour(rawStart);
                        const endTime = formatTimeTo12Hour(rawEnd);

                        const startMins = timeToMinutes(startTime);
                        const endMins = timeToMinutes(endTime);

                        const topOffset = ((startMins - 60) / 60) * 64;
                        const durationHours = Math.max(
                          0.5,
                          (endMins - startMins) / 60,
                        );
                        const blockHeight = durationHours * 64;

                        return (
                          <div
                            key={b.id || b.booking_id}
                            className={`absolute left-1 right-1 p-2 rounded-lg shadow-sm text-xs flex flex-col justify-between overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                              isApproved
                                ? "bg-emerald-500 text-white border border-emerald-600"
                                : "bg-amber-50 border-2 border-dashed border-amber-400 text-amber-900"
                            }`}
                            style={{
                              top: `${Math.max(0, topOffset)}px`,
                              height: `${Math.max(75, blockHeight)}px`,
                            }}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="font-bold text-[12px] leading-tight break-all">
                                  {resourceName}
                                </span>
                                <span
                                  className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    isApproved
                                      ? "bg-emerald-700/80 text-white"
                                      : "bg-amber-200 text-amber-800"
                                  }`}>
                                  {b.status ||
                                    (isApproved ? "Approved" : "Pending")}
                                </span>
                              </div>

                              <div className="text-[10.5px] opacity-95 flex items-center gap-1 font-medium">
                                <Clock size={10} className="shrink-0" />
                                <span>
                                  {startTime} - {endTime}
                                </span>
                              </div>

                              {b.destination && (
                                <div className="text-[10px] opacity-90 line-clamp-1">
                                  📍 {b.destination}
                                </div>
                              )}
                            </div>

                            <div
                              className={`text-[10.5px] font-medium opacity-95 pt-1 mt-1 border-t leading-tight break-words ${
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

      {/* RIGHT SIDEBAR: Mini Calendar & Legend Panel */}
      <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-line bg-white flex flex-col p-5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-ink">
            {monthYearLabel}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-paper rounded text-steel transition"
              title="Previous Month">
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-paper rounded text-steel transition"
              title="Next Month">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[12px] text-steel mb-2 font-medium">
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
        </div>
        <div className="grid grid-cols-7 text-center text-[12px] gap-y-1 mb-6 text-ink">
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
                className={`h-9 w-9 mx-auto flex flex-col items-center justify-center rounded-full transition relative ${
                  item.isCurrentMonth
                    ? "cursor-pointer hover:bg-paper"
                    : "text-steel/30 cursor-default"
                } ${isSelected ? "bg-brand text-white font-bold" : ""}`}>
                <span>{item.dayNum}</span>
                {item.isCurrentMonth && (hasApproved || hasPending) && (
                  <div className="flex items-center gap-0.5 absolute bottom-1">
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

        <hr className="border-line mb-4" />

        <div>
          <h4 className="text-[12px] font-semibold text-steel uppercase tracking-wider mb-3">
            Legend & Status
          </h4>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-ink font-medium">Approved Bookings</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-amber-400 border border-dashed border-amber-600 shrink-0" />
              <span className="text-ink font-medium">Pending Requests</span>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-paper rounded-lg p-3.5 border border-line/60">
          <p className="text-[12px] text-steel leading-relaxed">
            💡 <strong className="text-ink">Note:</strong> Pending requests
            display with dashed borders so admins can easily track tentative
            schedule slots.
          </p>
        </div>
      </aside>
    </div>
  );
}
