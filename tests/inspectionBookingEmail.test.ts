import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inspectionBookingEmail } from "@/lib/inspections/bookingEmail";
import { formatISODate } from "@/lib/business";

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
