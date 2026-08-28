import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { earliestBookableInspectionDate, isValidInspectionBookingDate, suggestedInspectionBookingDate } from "@/lib/business";

// The week these tests use, in Sydney:
//   Mon 24 · Tue 25 · Wed 26 · Thu 27 · Fri 28 · Sat 29 · Sun 30 August 2026
//   Mon 31 August · Tue 1 September
//
// Every instant is written with its Sydney offset, because that is the
// clock the rule works to — the inspector's morning is in New South
// Wales wherever the person booking happens to be sitting.
const at = (iso: string) => new Date(iso);

describe("how much notice an inspection needs", () => {
  test("asked before 1pm, the earliest is tomorrow", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-24T08:00:00+10:00")), "2026-08-25");
    assert.equal(earliestBookableInspectionDate(at("2026-08-24T12:59:00+10:00")), "2026-08-25");
  });

  test("asked at 1pm or after, the earliest is the day after", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-24T13:00:00+10:00")), "2026-08-26");
    assert.equal(earliestBookableInspectionDate(at("2026-08-24T17:30:00+10:00")), "2026-08-26");
  });

  // The whole end of the week points at the same day: a Monday
  // inspection would have to be arranged over a weekend nobody is
  // working.
  test("Friday, Saturday and Sunday all point at the Tuesday", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-28T09:00:00+10:00")), "2026-09-01", "Friday morning");
    assert.equal(earliestBookableInspectionDate(at("2026-08-28T16:00:00+10:00")), "2026-09-01", "Friday afternoon");
    assert.equal(earliestBookableInspectionDate(at("2026-08-29T11:00:00+10:00")), "2026-09-01", "Saturday");
    assert.equal(earliestBookableInspectionDate(at("2026-08-30T20:00:00+10:00")), "2026-09-01", "Sunday");
  });

  test("a Thursday afternoon lands on Tuesday, not Saturday", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-27T14:00:00+10:00")), "2026-09-01");
  });

  test("a Thursday morning is still Friday", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-27T09:00:00+10:00")), "2026-08-28");
  });

  test("a Wednesday afternoon is Friday", () => {
    assert.equal(earliestBookableInspectionDate(at("2026-08-26T15:00:00+10:00")), "2026-08-28");
  });

  // The clock that matters is Sydney's. Someone in London at 5am is in
  // the middle of the Sydney afternoon, and the cut-off has passed.
  test("the cut-off follows Sydney, not the visitor's own clock", () => {
    // 05:00 in London on the Monday is 14:00 Sydney — after the cut-off.
    assert.equal(earliestBookableInspectionDate(at("2026-08-24T05:00:00+01:00")), "2026-08-26");
    // 22:00 Sunday UTC is 08:00 Monday in Sydney — before it.
    assert.equal(earliestBookableInspectionDate(at("2026-08-23T22:00:00Z")), "2026-08-25");
  });
});

describe("checking and suggesting a date", () => {
  const monday9am = at("2026-08-24T09:00:00+10:00");

  test("a weekend is never a valid inspection day", () => {
    assert.equal(isValidInspectionBookingDate("2026-08-29", monday9am), false);
    assert.equal(isValidInspectionBookingDate("2026-08-30", monday9am), false);
  });

  test("anything earlier than the earliest day is refused", () => {
    assert.equal(isValidInspectionBookingDate("2026-08-24", monday9am), false, "today");
    assert.equal(isValidInspectionBookingDate("2026-08-25", monday9am), true, "tomorrow");
    assert.equal(isValidInspectionBookingDate("2026-09-10", monday9am), true, "further out is fine");
    assert.equal(isValidInspectionBookingDate("", monday9am), false);
  });

  test("the field is filled with the earliest day when nothing is chosen", () => {
    assert.equal(suggestedInspectionBookingDate("", monday9am), "2026-08-25");
  });

  test("a day too soon is moved forward, a valid one is left alone", () => {
    assert.equal(suggestedInspectionBookingDate("2026-08-24", monday9am), "2026-08-25");
    assert.equal(suggestedInspectionBookingDate("2026-09-10", monday9am), "2026-09-10");
  });

  test("a weekend chosen by hand moves to the Tuesday", () => {
    assert.equal(suggestedInspectionBookingDate("2026-08-29", monday9am), "2026-09-01", "Saturday");
    assert.equal(suggestedInspectionBookingDate("2026-08-30", monday9am), "2026-09-01", "Sunday");
  });
});

// The screen and the database each hold a copy of this rule, and a
// suggestion the database then refuses is worse than no suggestion at
// all. The two were compared hour by hour across three weeks — including
// both daylight-saving changeovers — against a real Postgres running
// migration 0049, and agreed on all 1,104 instants. These few pin the
// answers that comparison produced, so a later edit to one copy cannot
// quietly drift from the other.
describe("the answers the database gives for the same moments", () => {
  const cases: [string, string][] = [
    ["2026-08-24T09:00:00+10:00", "2026-08-25"],
    ["2026-08-24T13:00:00+10:00", "2026-08-26"],
    ["2026-08-27T14:00:00+10:00", "2026-09-01"],
    ["2026-08-28T09:00:00+10:00", "2026-09-01"],
    ["2026-08-29T11:00:00+10:00", "2026-09-01"],
    ["2026-08-30T20:00:00+10:00", "2026-09-01"],
    // Either side of the October changeover, when Sydney moves to +11.
    ["2026-10-02T09:00:00+10:00", "2026-10-06"],
    ["2026-10-05T09:00:00+11:00", "2026-10-06"],
    ["2026-10-05T13:30:00+11:00", "2026-10-07"],
  ];

  for (const [instant, expected] of cases) {
    test(`${instant} → ${expected}`, () => {
      assert.equal(earliestBookableInspectionDate(new Date(instant)), expected);
    });
  }
});
