export function getTodayDateInManila() {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}
