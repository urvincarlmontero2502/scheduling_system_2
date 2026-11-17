import assert from "node:assert/strict";
import test from "node:test";
import { groupCalendarBookings } from "./calendarEventGroups.js";

test("groups resource bookings for the same special event and schedule", () => {
  const groups = groupCalendarBookings([
    {
      id: 1,
      full_name: "Sumayajaw Festival",
      purpose: "Festival reservation",
      is_special_event: true,
      start_date: "2026-08-11",
      end_date: "2026-08-15",
      start_time: "07:00",
      end_time: "17:00",
      status: "approved",
      resource: "Cargo Truck",
    },
    {
      id: 2,
      full_name: "sumayajaw festival",
      purpose: "Festival reservation",
      is_special_event: true,
      start_date: "2026-08-11",
      end_date: "2026-08-15",
      start_time: "07:00",
      end_time: "17:00",
      status: "approved",
      resource: "Mini-Bus",
    },
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].resourceNames, ["Cargo Truck", "Mini-Bus"]);
  assert.equal(groups[0].bookings.length, 2);
});

test("keeps unrelated bookings and differently scheduled special events separate", () => {
  const groups = groupCalendarBookings([
    {
      id: 1,
      is_special_event: true,
      full_name: "Town Festival",
      start_date: "2026-08-11",
      end_date: "2026-08-15",
      start_time: "07:00",
      end_time: "17:00",
      status: "approved",
      resource: "Stage",
    },
    {
      id: 2,
      is_special_event: true,
      full_name: "Town Festival",
      start_date: "2026-08-11",
      end_date: "2026-08-15",
      start_time: "08:00",
      end_time: "17:00",
      status: "approved",
      resource: "Sound System",
    },
    {
      id: 3,
      is_special_event: false,
      full_name: "Mayor's Office",
      purpose: "Maintenance",
      start_date: "2026-08-11",
      end_date: "2026-08-15",
      start_time: "07:00",
      end_time: "17:00",
      status: "approved",
      resource: "Van",
    },
  ]);

  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((group) => group.bookings.length),
    [1, 1, 1],
  );
});
