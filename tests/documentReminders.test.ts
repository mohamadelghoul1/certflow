import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { outstandingSections, outstandingCount, reminderDue, reminderEmailHtml } from "@/lib/documentReminders";

// An email that chases a client for nothing — or fails to chase them for
// something — costs the certifier the client's patience either way. So
// what counts as outstanding, and when a reminder is due, are pinned
// down here rather than discovered by a client's reply.

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-26T21:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * day).toISOString();

describe("what counts as outstanding", () => {
  test("a requested document does; submitted and approved ones do not", () => {
    const sections = outstandingSections(
      [
        {
          kind: "pathway",
          checklist_items: [
            { title: "Architectural plans", status: "requested" },
            { title: "BASIX certificate", status: "submitted" },
            { title: "Structural drawings", status: "approved" },
          ],
        },
      ],
      "CDC"
    );
    assert.equal(outstandingCount(sections), 1);
    assert.equal(sections[0].items[0].title, "Architectural plans");
    assert.equal(sections[0].label, "CDC application documents");
  });

  // A document that came back with amendments is with the client again,
  // whatever its status says — that's what an unresolved amendment means.
  test("an unresolved amendment puts a document back on the list", () => {
    const sections = outstandingSections(
      [
        {
          kind: "oc",
          checklist_items: [
            { title: "Final survey", status: "submitted", amendments: [{ resolved: false }] },
            { title: "Smoke alarm certificate", status: "submitted", amendments: [{ resolved: true }] },
          ],
        },
      ],
      "CDC"
    );
    assert.equal(outstandingCount(sections), 1);
    assert.equal(sections[0].items[0].needsChanges, true);
    assert.equal(sections[0].label, "Occupation Certificate");
  });

  test("a fully settled job has nothing to chase", () => {
    const sections = outstandingSections(
      [{ kind: "pathway", checklist_items: [{ title: "Plans", status: "approved" }] }],
      "CC"
    );
    assert.deepEqual(sections, []);
  });
});

describe("when a reminder is due", () => {
  test("waits the full interval after the last reminder", () => {
    assert.equal(reminderDue({ createdAt: daysAgo(30), lastReminderAt: daysAgo(3), everyDays: 7 }, now), false);
    assert.equal(reminderDue({ createdAt: daysAgo(30), lastReminderAt: daysAgo(7), everyDays: 7 }, now), true);
  });

  // A certifier who pressed "Notify client" on Tuesday has been in
  // touch; the automatic chaser must not follow up on Thursday.
  test("a manual notification restarts the clock too", () => {
    assert.equal(reminderDue({ createdAt: daysAgo(30), lastReminderAt: daysAgo(10), lastNotifiedAt: daysAgo(2), everyDays: 7 }, now), false);
  });

  test("a brand-new job gets its full quiet period before the first chase", () => {
    assert.equal(reminderDue({ createdAt: daysAgo(2), everyDays: 7 }, now), false);
    assert.equal(reminderDue({ createdAt: daysAgo(8), everyDays: 7 }, now), true);
  });
});

describe("the reminder email", () => {
  test("lists every outstanding document under its checklist", () => {
    const html = reminderEmailHtml([
      { label: "CDC application documents", items: [{ title: "Architectural plans", needsChanges: false }] },
      { label: "Occupation Certificate", items: [{ title: "Final survey", needsChanges: true }] },
    ]);
    assert.ok(html.includes("Architectural plans"));
    assert.ok(html.includes("CDC application documents"));
    assert.ok(html.includes("needs changes"));
  });

  // A document titled with an ampersand or angle bracket must not break
  // the email or inject markup into it.
  test("keeps document titles as text, not markup", () => {
    const html = reminderEmailHtml([{ label: "CDC application documents", items: [{ title: "Plans <v2> & specs", needsChanges: false }] }]);
    assert.ok(html.includes("Plans &lt;v2&gt; &amp; specs"));
  });
});
