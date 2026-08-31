import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inspectionBookingEmail } from "@/lib/inspections/bookingEmail";
import { formatISODate, inspectionFinished } from "@/lib/business";

// The email a builder gets when the certifier books the visit
// themselves. Someone arranges their morning around it, so the day it
// names and whether it reads as a new booking or a change both matter.
describe("what a client is told when the certifier books an inspection", () => {
  test("a first booking says it has been booked, and for which day", () => {
    const mail = inspectionBookingEmail("Footings and Slab", "2026-09-14", false);
    assert.equal(mail.subject, "Inspection booked — Footings and Slab");
    assert.match(mail.html, /We have booked your <strong>Footings and Slab<\/strong> inspection/);
    // Asserted against the app's own formatter rather than a typed-out
    // date: Node's en-AU rendering is not ours to pin.
    assert.ok(mail.html.includes(`<strong>${formatISODate("2026-09-14")}</strong>`));
  });

  test("moving a booked inspection says it has been moved, not booked", () => {
    const mail = inspectionBookingEmail("Frame", "2026-09-21", true);
    assert.equal(mail.subject, "Inspection rescheduled — Frame");
    assert.match(mail.html, /has been moved to/);
    assert.ok(!mail.html.includes("We have booked"), "a change must never read as a first booking");
  });

  test("either way it asks for the site to be ready and offers another day", () => {
    for (const rebooking of [false, true]) {
      const { html } = inspectionBookingEmail("Final", "2026-10-02", rebooking);
      assert.match(html, /site is ready and accessible/);
      assert.match(html, /call us and we will find another/);
    }
  });
});

// Green on an inspection card means one thing: the visit happened and
// the regulator was told. The Portal must hear within two business days,
// so a card that reads as finished before that is a missed deadline
// waiting to happen.
describe("when an inspection reads as finished", () => {
  test("carried out and reported to the Portal", () => {
    assert.equal(inspectionFinished(null, true, "passed"), true);
    assert.equal(inspectionFinished(null, true, "failed"), true);
    assert.equal(inspectionFinished(null, true, "passed_subject_to"), true);
  });

  test("carried out but the Portal not told is not finished", () => {
    assert.equal(inspectionFinished("2026-09-01T00:00:00Z", false, "passed"), false);
  });

  test("reported but not yet carried out is not finished", () => {
    assert.equal(inspectionFinished(null, true, "pending"), false);
  });

  // Callers that do not know the outcome — the on-site screen among them
  // — keep the older rule, which asks for the signed report instead.
  test("without an outcome it falls back to the signed report", () => {
    assert.equal(inspectionFinished("2026-09-01T00:00:00Z", true), true);
    assert.equal(inspectionFinished(null, true), false);
  });
});
