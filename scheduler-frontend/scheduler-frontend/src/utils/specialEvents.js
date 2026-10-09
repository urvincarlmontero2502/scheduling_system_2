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
