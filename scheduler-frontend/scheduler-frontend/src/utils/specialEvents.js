// Yearly special events (festival, alumni, Habongan) are stored as approved
// bookings so they block resources, but they are not user requests.
export function isSpecialEvent(booking) {
  return /festival|alumni|habongan/i.test(booking?.purpose || "");
}
