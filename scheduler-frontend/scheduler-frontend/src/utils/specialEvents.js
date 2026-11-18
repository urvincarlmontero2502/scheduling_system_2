// Yearly special events (festival, alumni, Habongan) are stored as approved
// bookings so they block resources, but they are not user requests.
export function isSpecialEvent(booking) {
  if (!booking) return false;
  
  // Primary check: the dedicated flag from the backend
  if (booking.is_special_event === true) return true;
  
  // Fallback: legacy pattern matching for bookings created before the flag existed
  // Check both purpose and full_name since some special events store their title in full_name
  const purpose = booking.purpose || "";
  const fullName = booking.full_name || "";
  return /festival|alumni|habongan/i.test(purpose) || /festival|alumni|habongan/i.test(fullName);
}

export function isRecurringSpecialEventDate(dateString, templates = []) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
  const monthDay = month * 100 + day;

  return templates.some((template) => {
    const startYear = Number(template.start_year);
    const startMonth = Number(template.start_month);
    const endMonth = Number(template.end_month);
    const startDay = Math.min(
      Number(template.start_day),
      new Date(year, startMonth, 0).getDate(),
    );
    const endDay = Math.min(
      Number(template.end_day),
      new Date(year, endMonth, 0).getDate(),
    );
    const start = startMonth * 100 + startDay;
    const end = endMonth * 100 + endDay;

    return year >= startYear && monthDay >= start && monthDay <= end;
  });
}
