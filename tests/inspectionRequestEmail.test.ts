import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inspectionRequestEmail } from "@/lib/inspections/bookingRequestEmail";
import { formatISODate } from "@/lib/business";

// The email that decides whether a requested day can be accepted. It has
// to answer that without the certifier opening anything: where the site
// is, and what is already booked for the same day.
describe("the email a certifier gets when a client asks for a day", () => {
  const sameDay = [
    { title: "Frame", address: "8 Junee Street, Marayong NSW 2148", certifier: "Rahman Yaman" },
    { title: "Final", address: "43A Edna Avenue, Mount Pritchard NSW 2170", certifier: null },
  ];

  test("names the site in the subject and the body", () => {
    const mail = inspectionRequestEmail({ title: "Footings and Slab", date: "2026-09-14", address: "21 Coquet Way, Green Valley NSW 2168", sameDay: [] });
    assert.match(mail.subject, /21 Coquet Way, Green Valley NSW 2168/);
    assert.match(mail.html, /<strong>Site:<\/strong> 21 Coquet Way, Green Valley NSW 2168/);
  });

  test("lists what is already booked for that day", () => {
    const { html } = inspectionRequestEmail({ title: "Piers", date: "2026-09-14", address: "21 Coquet Way", sameDay });
    assert.match(html, /Already booked for/);
    assert.match(html, /Frame — 8 Junee Street, Marayong NSW 2148 \(Rahman Yaman\)/);
    // No certifier assigned yet is not a reason to leave the visit out.
    assert.match(html, /Final — 43A Edna Avenue, Mount Pritchard NSW 2170/);
  });

  test("says so plainly when the day is otherwise free", () => {
    const { html } = inspectionRequestEmail({ title: "Piers", date: "2026-09-14", address: "21 Coquet Way", sameDay: [] });
    assert.match(html, /Nothing else is booked for that day/);
  });

  test("carries the requested day, formatted as the app formats dates", () => {
    const { html } = inspectionRequestEmail({ title: "Piers", date: "2026-09-14", address: null, sameDay: [] });
    assert.ok(html.includes(`<strong>${formatISODate("2026-09-14")}</strong>`));
  });

  // An address and an inspection name are both typed by people. A stray
  // angle bracket must not be able to reshape the email around it.
  test("escapes what people typed", () => {
    const { html, subject } = inspectionRequestEmail({
      title: "Frame <b>x</b>",
      date: "2026-09-14",
      address: "1 <script>alert(1)</script> Street",
      sameDay: [{ title: "<i>Piers</i>", address: "2 & 3 Road", certifier: null }],
    });
    assert.ok(!html.includes("<script>"), "no raw markup from an address");
    assert.ok(!html.includes("<b>x</b>"), "nor from an inspection's name");
    assert.ok(html.includes("2 &amp; 3 Road"));
    // The subject is plain text in a mail header, so it is not escaped —
    // it simply carries what was typed.
    assert.match(subject, /Inspection requested/);
  });

  test("a job with no address recorded still sends", () => {
    const { html, subject } = inspectionRequestEmail({ title: "Piers", date: "2026-09-14", address: null, sameDay: [] });
    assert.ok(!html.includes("Site:"), "no empty site line");
    assert.equal(subject, "Inspection requested — Piers");
  });
});
