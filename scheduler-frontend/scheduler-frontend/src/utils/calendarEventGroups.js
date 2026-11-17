import { getBookingResourceNames } from "./bookingResources.js";
import { isSpecialEvent } from "./specialEvents.js";

function normalizedTime(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getSpecialEventName(booking) {
  return String(booking.full_name || booking.purpose || "Special Event").trim();
}

export function groupCalendarBookings(bookings = []) {
  const groups = new Map();

  bookings.forEach((booking, index) => {
    const special = isSpecialEvent(booking);
    const startDate = String(booking.start_date || booking.date || "").slice(
      0,
      10,
    );
    const endDate = String(booking.end_date || startDate).slice(0, 10);
    const status = String(booking.status || "").toLowerCase();
    const eventName = special ? getSpecialEventName(booking) : "";
    const key = special
      ? JSON.stringify([
          "special",
          eventName.toLowerCase(),
          startDate,
          endDate,
          normalizedTime(booking.start_time || booking.time),
          normalizedTime(booking.end_time),
          status,
        ])
      : JSON.stringify(["booking", booking.id ?? booking.booking_id ?? index]);

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        eventName,
        isSpecial: special,
        bookings: [],
        resourceNames: new Set(),
      };
      groups.set(key, group);
    }

    group.bookings.push(booking);
    getBookingResourceNames(booking).forEach((name) =>
      group.resourceNames.add(name),
    );
  });

  return [...groups.values()].map((group) => ({
    ...group,
    resourceNames: [...group.resourceNames],
  }));
}
