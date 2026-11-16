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

export function parseResourceInclusions(value) {
  if (typeof value !== "string" || !value.trim()) return [];

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
