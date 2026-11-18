import assert from "node:assert/strict";
import test from "node:test";
import { isRecurringSpecialEventDate } from "./specialEvents.js";

const templates = [
  {
    start_year: 2027,
    start_month: 7,
    start_day: 21,
    end_month: 7,
    end_day: 22,
  },
];

test("marks a configured annual date range from its start year onward", () => {
  assert.equal(isRecurringSpecialEventDate("2026-07-21", templates), false);
  assert.equal(isRecurringSpecialEventDate("2027-07-21", templates), true);
  assert.equal(isRecurringSpecialEventDate("2029-07-22", templates), true);
  assert.equal(isRecurringSpecialEventDate("2029-07-23", templates), false);
});

test("ignores invalid dates and empty template lists", () => {
  assert.equal(isRecurringSpecialEventDate("not-a-date", templates), false);
  assert.equal(isRecurringSpecialEventDate("2028-07-21"), false);
});

test("clamps February 29 recurrences in non-leap years", () => {
  const leapDayTemplate = [
    {
      start_year: 2028,
      start_month: 2,
      start_day: 29,
      end_month: 2,
      end_day: 29,
    },
  ];

  assert.equal(isRecurringSpecialEventDate("2029-02-28", leapDayTemplate), true);
  assert.equal(isRecurringSpecialEventDate("2029-02-29", leapDayTemplate), false);
});
