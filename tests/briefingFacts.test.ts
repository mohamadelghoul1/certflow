import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildBriefingFacts, factsAsText, factsHash, isQuiet, whenLabel, dayLabel, type BriefingJobRow } from "@/lib/assistant/briefingFacts";
import { standardBriefing, parseBriefing, keepKnownJobs, briefingPrompt } from "@/lib/assistant/briefing";

// The assistant's note is written from facts the app has already
// digested — times in Sydney time that already say "yesterday", counts
// already counted. These tests hold the digestion to the rules, because
// the model repeats what it is given and a wrong "yesterday" here is a
// wrong "yesterday" on every dashboard.

// Wednesday 2 September 2026, 10:30 am in Sydney (AEST, UTC+10).
const NOW = new Date("2026-09-02T00:30:00Z");

function job(overrides: Partial<BriefingJobRow> = {}): BriefingJobRow {
  return { id: "j1", address: "12 Example St, Liverpool", pathway: "CDC", checklists: [], inspections: [], ...overrides };
}

describe("saying when something happened", () => {
  test("today, yesterday, then the day itself", () => {
    assert.match(whenLabel("2026-09-02T00:00:00Z", NOW), /^today 10:00\s?am$/);
    assert.match(whenLabel("2026-09-01T05:40:00Z", NOW), /^yesterday 3:40\s?pm$/);
    assert.match(whenLabel("2026-08-28T06:05:00Z", NOW), /^Fri 28 Aug, 4:05\s?pm$/);
  });

  // An upload at 11 pm Sydney is still "today" in Sydney even though it
  // is already tomorrow in UTC.
  test("the day is Sydney's day, not the server's", () => {
    assert.match(whenLabel("2026-09-01T13:30:00Z", NOW), /^yesterday 11:30\s?pm$/);
  });

  test("inspection days read the same way", () => {
    assert.equal(dayLabel("2026-09-02", "2026-09-02"), "today");
    assert.equal(dayLabel("2026-09-03", "2026-09-02"), "tomorrow");
    assert.equal(dayLabel("2026-09-01", "2026-09-02"), "yesterday");
    assert.match(dayLabel("2026-09-04", "2026-09-02"), /^Friday 4 Sept? \(in 2 days\)$/);
    assert.match(dayLabel("2026-08-30", "2026-09-02"), /^Sunday 30 Aug \(3 days ago\)$/);
  });
});

describe("reading the facts off the projects", () => {
  const jobs: BriefingJobRow[] = [
    job({
      checklists: [
        {
          kind: "pathway",
          checklist_items: [
            {
              title: "Site plan",
              status: "submitted",
              updated_at: "2026-08-30T02:00:00Z",
              checklist_item_files: [
                { created_at: "2026-09-01T05:40:00Z", uploaded_by_role: "client" },
                { created_at: "2026-08-20T05:40:00Z", uploaded_by_role: "client" },
              ],
            },
            { title: "BASIX certificate", status: "submitted", updated_at: "2026-09-02T00:00:00Z", checklist_item_files: [{ created_at: "2026-09-02T00:00:00Z", uploaded_by_role: "certifier" }] },
            { title: "Structural drawings", status: "submitted", amendments: [{ resolved: false }] },
            { title: "Survey", status: "requested" },
            { title: "Peer review", status: "requested", internal: true },
          ],
        },
      ],
      inspections: [
        { id: "i1", title: "Slab inspection", date: "2026-09-02", outcome: "pending", booked_by_client: true, confirmed: false },
        { id: "i2", title: "Frame inspection", date: "2026-09-04", outcome: "pending", booked_by_client: false, confirmed: true },
        { id: "i3", title: "Piers", date: "2026-08-30", outcome: "pending", booked_by_client: false, confirmed: true },
        { id: "i4", title: "Footings", date: "2026-08-25", outcome: "passed", booked_by_client: false, confirmed: true },
        { id: "i5", title: "Final", date: "2026-09-20", outcome: "pending", booked_by_client: false, confirmed: true },
      ],
    }),
  ];

  const facts = buildBriefingFacts({
    jobs,
    compliance: [
      { severity: "overdue", dueDate: "2026-08-30", title: "Invoice 12 overdue", detail: "$1,200", href: "/invoices" },
      { severity: "upcoming", dueDate: "2026-12-01", title: "PI insurance", detail: "renews", href: "/settings" },
    ],
    receivables: { outstanding: 3000, overdue: 1200, overdueCount: 1 },
    now: NOW,
  });

  test("only a client's uploads inside the window count, newest first", () => {
    assert.deepEqual(
      facts.uploads.map((u) => [u.title, u.stage]),
      [["Site plan", "CDC application"]]
    );
    assert.match(facts.uploads[0].when, /^yesterday 3:40\s?pm$/);
  });

  test("submitted documents wait on the certifier; sent-back ones are the client's again", () => {
    assert.equal(facts.awaitingReview.length, 1);
    assert.deepEqual(facts.awaitingReview[0].titles, ["Site plan", "BASIX certificate"]);
    assert.equal(facts.awaitingReview[0].waitingDays, 3);
    assert.deepEqual(facts.stillOutstanding[0].titles, ["Structural drawings", "Survey"], "internal items are not the client's to send");
  });

  test("bookings, the days ahead, and inspections that passed with no result", () => {
    assert.deepEqual(facts.bookingsToConfirm.map((b) => b.title), ["Slab inspection"]);
    assert.deepEqual(
      facts.inspectionsAhead.map((i) => [i.title, i.when]),
      [
        ["Slab inspection", "today"],
        ["Frame inspection", dayLabel("2026-09-04", "2026-09-02")],
      ]
    );
    assert.deepEqual(facts.inspectionsUnrecorded.map((i) => i.title), ["Piers"], "a passed inspection is recorded; one three weeks out is not overdue");
  });

  test("only deadlines that are due or overdue make the note", () => {
    assert.deepEqual(facts.deadlines.map((d) => d.title), ["Invoice 12 overdue"]);
  });

  test("the text names the job beside every fact, so the model can hand the id back", () => {
    const text = factsAsText(facts);
    assert.ok(text.includes("Today is Wednesday 2 September 2026."));
    assert.match(text, /12 Example St, Liverpool \[job j1\]: "Site plan" \(CDC application\) uploaded yesterday 3:40\s?pm/);
    assert.ok(text.includes("oldest waiting 3 days"));
    assert.ok(text.includes("OVERDUE: Invoice 12 overdue"));
    assert.ok(text.includes("$3,000.00 owed on invoices, of which $1,200.00 is overdue on 1 invoice"));
    assert.ok(briefingPrompt(facts, "Mohamad").startsWith("The certifier's first name is Mohamad."));
  });

  test("the fingerprint moves when the facts do, and when the day does", () => {
    const same = buildBriefingFacts({ jobs, compliance: [], receivables: null, now: NOW });
    assert.equal(factsHash(same), factsHash(buildBriefingFacts({ jobs, compliance: [], receivables: null, now: NOW })));
    assert.notEqual(factsHash(same), factsHash(facts));
    assert.notEqual(factsHash(same), factsHash(buildBriefingFacts({ jobs, compliance: [], receivables: null, now: new Date("2026-09-03T00:30:00Z") })));
  });

  test("a quiet morning is said in one line", () => {
    const quiet = buildBriefingFacts({ jobs: [job()], compliance: [], receivables: null, now: NOW });
    assert.equal(isQuiet(quiet), true);
    assert.ok(factsAsText(quiet).includes("Nothing has come in"));
    const note = standardBriefing(quiet);
    assert.ok(note.headline.startsWith("All quiet"));
    assert.equal(note.points.length, 0);
  });

  test("without the AI, every fact is a point of its own, most urgent first", () => {
    const note = standardBriefing(facts);
    assert.ok(note.points[0].text.includes("booked Slab inspection"), "a booking to confirm comes first");
    assert.ok(note.points.some((p) => p.text.includes('uploaded "Site plan"') && p.jobId === "j1"));
    assert.ok(note.points.some((p) => p.text.includes("waiting on you to assess")));
    assert.ok(note.headline.includes("1 upload from clients"));
  });
});

describe("what comes back from the model", () => {
  test("points keep their job link only when the job was in the facts", () => {
    const parsed = parseBriefing('{"headline":"Busy morning.","points":[{"text":"A","jobId":"j1"},{"text":"B","jobId":"j9"},{"text":"C","jobId":null},{"text":"  "}]}');
    const kept = keepKnownJobs(parsed, new Set(["j1"]));
    assert.deepEqual(
      kept.points.map((p) => [p.text, p.jobId]),
      [
        ["A", "j1"],
        ["B", null],
        ["C", null],
      ]
    );
  });

  test("the wrong shape is refused", () => {
    assert.throws(() => parseBriefing('{"points":[]}'), /expected shape/);
  });
});
