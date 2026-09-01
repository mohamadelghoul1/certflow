import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { notificationFirstDay, notificationEndDate } from "@/lib/neighbourNotification";

// The 15-day neighbour notification, counted the way the practice
// counts it: the start date is day one — except a Friday start, which
// sits in letterboxes over the weekend and is counted from the
// following Tuesday.

describe("the neighbour notification period", () => {
  test("an ordinary start is day one, and the period ends 14 days later", () => {
    // 7 September 2026 is a Monday.
    assert.equal(notificationFirstDay("2026-09-07"), "2026-09-07");
    assert.equal(notificationEndDate("2026-09-07"), "2026-09-21");
  });

  test("a Friday start is counted from the following Tuesday", () => {
    // 4 September 2026 is a Friday; the Tuesday after is the 8th.
    assert.equal(notificationFirstDay("2026-09-04"), "2026-09-08");
    assert.equal(notificationEndDate("2026-09-04"), "2026-09-22");
  });

  test("a Thursday start counts as its own day one", () => {
    // Only Friday carries the rule — the day before it does not.
    assert.equal(notificationFirstDay("2026-09-03"), "2026-09-03");
    assert.equal(notificationEndDate("2026-09-03"), "2026-09-17");
  });

  test("the count is 15 days inclusive of day one", () => {
    // Day one the 7th, day fifteen the 21st: 15 days, not 16.
    const first = new Date("2026-09-07T00:00:00");
    const last = new Date(notificationEndDate("2026-09-07")! + "T00:00:00");
    assert.equal((last.getTime() - first.getTime()) / 86400000 + 1, 15);
  });

  test("a date that is not a date answers with nothing", () => {
    assert.equal(notificationFirstDay("not a date"), null);
    assert.equal(notificationEndDate(""), null);
  });

  test("a full timestamp is read as its date", () => {
    assert.equal(notificationEndDate("2026-09-07T10:30:00.000Z"), "2026-09-21");
  });
});
