import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyBookingEstimate } from "./resourcePricing.js";

test("calculates a facility estimate using inclusive booked days", () => {
  assert.deepEqual(
    calculateDailyBookingEstimate("2026-11-19", "2026-11-21", 12500),
    {
      billableDays: 3,
      dailyRate: 12500,
      total: 37500,
    },
  );
});

test("keeps the booked-day count when a facility rate is not configured", () => {
  assert.deepEqual(
    calculateDailyBookingEstimate("2026-11-19", "2026-11-20", null),
    {
      billableDays: 2,
      dailyRate: null,
      total: null,
    },
  );
});

test("rejects an invalid or reversed facility date range", () => {
  assert.equal(calculateDailyBookingEstimate("2026-11-21", "2026-11-19", 12500), null);
  assert.equal(calculateDailyBookingEstimate("not-a-date", "2026-11-20", 12500), null);
});
