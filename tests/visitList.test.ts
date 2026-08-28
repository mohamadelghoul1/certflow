import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { visitGroups, nextStep, stillToAttend, directionsUrl, type VisitInspection } from "@/lib/site/visitList";

const TODAY = "2026-08-26";

function visit(over: Partial<VisitInspection> = {}): VisitInspection {
  return {
    id: "i1",
    job_id: "j1",
    title: "Slab steel",
    date: TODAY,
    outcome: "pending",
    confirmed: true,
    booked_by_client: false,
    report_signed_at: null,
    address: "21 Coquet Way, Green Valley",
    ...over,
  };
}

describe("the day's work, as an inspector needs it", () => {
  test("groups by when, with anything overdue first", () => {
    const groups = visitGroups(
      [
        visit({ id: "later", date: "2026-08-29" }),
        visit({ id: "today", date: TODAY }),
        visit({ id: "overdue", date: "2026-08-20" }),
        visit({ id: "tomorrow", date: "2026-08-27" }),
      ],
      TODAY
    );
    assert.deepEqual(
      groups.map((g) => g.key),
      ["overdue", "today", "tomorrow", "soon"]
    );
    assert.deepEqual(groups[0].inspections.map((i) => i.id), ["overdue"]);
    assert.deepEqual(groups[1].inspections.map((i) => i.id), ["today"]);
  });

  // An inspection whose date has passed with no outcome is the one thing
  // on this screen that is actually wrong.
  test("overdue means the date passed and nothing was recorded", () => {
    assert.equal(stillToAttend(visit({ outcome: "pending" })), true);
    assert.equal(stillToAttend(visit({ outcome: "passed" })), false);
    const groups = visitGroups([visit({ date: "2026-08-20", outcome: "passed" })], TODAY);
    assert.deepEqual(groups, [], "an attended visit is not overdue, whatever its date");
  });

  test("an empty group is left off the screen entirely", () => {
    const groups = visitGroups([visit({ date: TODAY })], TODAY);
    assert.deepEqual(groups.map((g) => g.key), ["today"]);
  });

  test("nothing beyond the week ahead, and nothing without a date", () => {
    const groups = visitGroups([visit({ id: "far", date: "2026-10-01" }), visit({ id: "undated", date: null })], TODAY);
    assert.deepEqual(groups, []);
  });

  test("two visits on the same day read in address order", () => {
    const groups = visitGroups(
      [visit({ id: "b", address: "9 Wilkins Street" }), visit({ id: "a", address: "21 Coquet Way" })],
      TODAY
    );
    assert.deepEqual(groups[0].inspections.map((i) => i.id), ["a", "b"]);
  });
});

describe("what an inspection is waiting on", () => {
  test("an outcome, then a signature, then nothing", () => {
    assert.equal(nextStep({ outcome: "pending", report_signed_at: null }), "outcome");
    assert.equal(nextStep({ outcome: "passed", report_signed_at: null }), "sign");
    assert.equal(nextStep({ outcome: "passed", report_signed_at: "2026-08-26T04:00:00Z" }), "done");
  });

  test("a failed inspection still needs its report signed", () => {
    assert.equal(nextStep({ outcome: "failed", report_signed_at: null }), "sign");
  });
});

test("the address becomes a map link, escaped", () => {
  assert.equal(
    directionsUrl("21 Coquet Way, Green Valley"),
    "https://www.google.com/maps/dir/?api=1&destination=21%20Coquet%20Way%2C%20Green%20Valley"
  );
});
