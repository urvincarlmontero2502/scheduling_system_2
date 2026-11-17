export function getBookingResourceNames(booking = {}) {
  const names = Array.isArray(booking.resource_names)
    ? booking.resource_names
    : Array.isArray(booking.vehicles)
      ? booking.vehicles.map((vehicle) => vehicle.name || vehicle.resource_name)
      : [];
  const validNames = names.filter(Boolean);
  if (validNames.length) return validNames;

  const primaryName =
    typeof booking.resource === "object"
      ? booking.resource?.name || booking.resource?.resource_name
      : booking.resource;
  return [
    primaryName || booking.resource_name || booking.item_name || "Unknown Resource",
  ];
}

export function getBookingResourceIds(booking = {}) {
  const ids = [
    ...(Array.isArray(booking.resource_ids) ? booking.resource_ids : []),
    ...(Array.isArray(booking.vehicles)
      ? booking.vehicles.map((vehicle) => vehicle.resource_id ?? vehicle.id)
      : []),
    booking.resource_id ?? booking.item_id ?? booking.resourceId,
    typeof booking.resource === "object"
      ? booking.resource?.resource_id ?? booking.resource?.id
      : null,
  ];
  return [...new Set(ids.filter((id) => id != null).map(String))];
}
