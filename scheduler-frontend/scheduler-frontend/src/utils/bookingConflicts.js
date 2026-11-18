function formatTime(time) {
  const match = String(time || "").match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i,
  );
  if (!match) return time;

  let hour = Number(match[1]);
  const suffix = match[3]?.toUpperCase();
  if (!suffix) {
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${match[2]} ${period}`;
  }

  return `${hour}:${match[2]} ${suffix}`;
}

export function formatBookingConflictDetails(conflicts) {
  if (!Array.isArray(conflicts)) return [];

  return conflicts.map((conflict) => {
    const startDate = String(conflict.start_date || "").split("T")[0];
    const endDate = String(conflict.end_date || conflict.start_date || "").split("T")[0];
    const dateRange = startDate === endDate
      ? startDate
      : `${startDate} to ${endDate}`;
    const timeRange = conflict.start_time && conflict.end_time
      ? ` (${formatTime(conflict.start_time)}–${formatTime(conflict.end_time)})`
      : " (all day)";
    const status = String(conflict.status || "approved").toLowerCase();
    const rawBufferMinutes = Number(conflict.buffer_minutes ?? 30);
    const bufferMinutes = Number.isFinite(rawBufferMinutes)
      ? Math.max(0, rawBufferMinutes)
      : 30;
    const article = /^[aeiou]/.test(status) ? "an" : "a";

    return `${conflict.resource_name || "Resource"} conflicts with ${article} ${status} booking on ${dateRange}${timeRange}; the ${bufferMinutes}-minute turnaround buffer is included.`;
  });
}
