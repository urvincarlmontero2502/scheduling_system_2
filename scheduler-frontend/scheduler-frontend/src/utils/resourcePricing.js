export function formatResourcePrice(value) {
  if (value == null || String(value).trim() === "") return "₱--";

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "₱--";

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function calculateHourlyRentalEstimate(startMinute, endMinute, rate) {
  if (
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endMinute) ||
    endMinute <= startMinute
  ) {
    return null;
  }

  const durationMinutes = endMinute - startMinute;
  const billableHours = Math.ceil(durationMinutes / 60);
  const hourlyRate = Number(rate);
  const hasHourlyRate =
    rate != null &&
    String(rate).trim() !== "" &&
    Number.isFinite(hourlyRate) &&
    hourlyRate >= 0;

  return {
    durationMinutes,
    billableHours,
    total: hasHourlyRate ? hourlyRate * billableHours : null,
  };
}

export function dateTimeToMinutes(date, time, isEnd = false) {
  const datePart = String(date || "").split("T")[0];
  const dayStart = Date.parse(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(dayStart)) return null;

  const match = String(time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  let minuteOfDay = isEnd ? 24 * 60 : 0;
  if (match) {
    let hours = Number(match[1]);
    const period = (match[3] || "").toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    minuteOfDay = hours * 60 + Number(match[2]);
  }

  return dayStart / 60000 + minuteOfDay;
}

export function calculateBookingHourlyEstimate(booking) {
  return calculateHourlyRentalEstimate(
    dateTimeToMinutes(booking?.start_date, booking?.start_time),
    dateTimeToMinutes(
      booking?.end_date || booking?.start_date,
      booking?.end_time,
      true,
    ),
    booking?.price_per_hour,
  );
}

export function calculateDailyBookingEstimate(startDate, endDate, rate) {
  const start = Date.parse(`${String(startDate || "").split("T")[0]}T00:00:00Z`);
  const end = Date.parse(`${String(endDate || "").split("T")[0]}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  const billableDays = Math.floor((end - start) / 86400000) + 1;
  const hasDailyRate =
    rate != null &&
    String(rate).trim() !== "" &&
    Number.isFinite(Number(rate)) &&
    Number(rate) >= 0;

  return {
    billableDays,
    dailyRate: hasDailyRate ? Number(rate) : null,
    total: hasDailyRate ? Number(rate) * billableDays : null,
  };
}

export function formatRentalDuration(durationMinutes) {
  return `${Math.floor(durationMinutes / 60)}h${
    durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ""
  }`;
}

export function parseResourceInclusions(value) {
  if (typeof value !== "string" || !value.trim()) return [];

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
