import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, escapeText, foldLine } from "@/lib/calendar/ics";
import { diaryWeek, overdueInspections, startOfWeek, suburbOf, weekdayIndex } from "@/lib/calendar/week";

// A calendar app that dislikes a feed does not complain — it shows an
// empty diary. So the format is tested rather than eyeballed.
describe("the calendar feed", () => {
  test("characters that would end a line early are escaped", () => {
    assert.equal(escapeText("21 Coquet Way, Green Valley"), "21 Coquet Way\\, Green Valley");
    assert.equal(escapeText("Slab; steel"), "Slab\\; steel");
    assert.equal(escapeText("a\\b"), "a\\\\b", "the backslash is escaped first, or it escapes the escapes");
    assert.equal(escapeText("line one\nline two"), "line one\\nline two");
  });

  test("a long line is folded, and unfolds back to what went in", () => {
    const line = `SUMMARY:${"A".repeat(200)}`;
    const folded = foldLine(line);
    assert.ok(folded.includes("\r\n "), "a 208-character line has to be continued");
    assert.equal(folded.replace(/\r\n /g, ""), line, "unfolding gives back the original");
    for (const part of folded.split("\r\n")) assert.ok(Buffer.from(part, "utf8").length <= 75);
  });

  // Folding counts octets, not characters, and a split inside a
  // character corrupts it. An address with an accent is the case that
  // finds this.
  test("folding never splits a character in half", () => {
    const line = `LOCATION:${"é".repeat(80)}`;
    const folded = foldLine(line);
    assert.equal(folded.replace(/\r\n /g, ""), line);
    assert.ok(!folded.includes("�"), "a character split across a fold decodes as a replacement character");
  });

  test("a short line is left alone", () => {
    assert.equal(foldLine("SUMMARY:Piers"), "SUMMARY:Piers");
  });

  const event = {
    uid: "insp-1@certflow",
    date: "2026-08-26",
    summary: "Piers — 28 Eucalyptus Street",
    location: "28 Eucalyptus Street, Constitution Hill",
    description: "Booked by the client.",
    url: "https://certflow.app/site/insp-1",
  };

  test("an inspection becomes a one-day event on the day it is booked", () => {
    const ics = buildIcs([event], "QP Certifiers — inspections", new Date("2026-08-25T04:00:00Z"));
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20260826"));
    // Exclusive end: a one-day event on the 26th ends on the 27th.
    // The 26th would show as nothing at all.
    assert.ok(ics.includes("DTEND;VALUE=DATE:20260827"));
    assert.ok(ics.includes("UID:insp-1@certflow"));
    assert.ok(ics.includes("DTSTAMP:20260825T040000Z"));
  });

  test("every line ends CRLF and the calendar is closed", () => {
    const ics = buildIcs([event], "Inspections");
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "a bare newline is not a line ending in this format");
  });

  test("a URL is not escaped — an escaped one opens nothing", () => {
    const ics = buildIcs([event], "Inspections");
    assert.ok(ics.includes("URL:https://certflow.app/site/insp-1"));
  });

  test("an empty diary is still a valid calendar", () => {
    const ics = buildIcs([], "Inspections");
    assert.ok(ics.includes("BEGIN:VCALENDAR") && ics.includes("END:VCALENDAR"));
    assert.ok(!ics.includes("BEGIN:VEVENT"));
  });
});

describe("the inspection week", () => {
  // 2026-08-26 is a Wednesday.
  test("weeks start on Monday, so a working week reads in one row", () => {
    assert.equal(weekdayIndex("2026-08-24"), 0, "Monday");
    assert.equal(weekdayIndex("2026-08-30"), 6, "Sunday");
    assert.equal(startOfWeek("2026-08-26"), "2026-08-24");
    assert.equal(startOfWeek("2026-08-30"), "2026-08-24", "Sunday belongs to the week that just ended");
    assert.equal(startOfWeek("2026-08-24"), "2026-08-24");
  });

  test("the suburb is read off the end of the address", () => {
    assert.equal(suburbOf("28 Eucalyptus Street, Constitution Hill"), "Constitution Hill");
    assert.equal(suburbOf("21 Coquet Way, Green Valley NSW 2168"), "Green Valley");
    assert.equal(suburbOf("45 Sharples Circuit, Oran Park, NSW 2570"), "");
    assert.equal(suburbOf(""), "");
  });

  const inspection = (id: string, date: string | null, address: string, outcome = "pending") => ({
    id, job_id: `job-${id}`, title: "Slab Steel", date, outcome, confirmed: true, booked_by_client: false, address, certifier: null,
  });

  test("a week is seven days whether or not anything is booked", () => {
    const week = diaryWeek([], "2026-08-24", "2026-08-26");
    assert.equal(week.length, 7);
    assert.deepEqual(week.map((d) => d.weekday), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    assert.deepEqual(week.map((d) => d.isWeekend), [false, false, false, false, false, true, true]);
    assert.equal(week.filter((d) => d.isToday).length, 1);
  });

  test("inspections land on their own day and nowhere else", () => {
    const week = diaryWeek([inspection("a", "2026-08-25", "1 A St, Oran Park"), inspection("b", "2026-09-02", "2 B St, Penrith")], "2026-08-24", "2026-08-26");
    assert.deepEqual(week.map((d) => d.inspections.length), [0, 1, 0, 0, 0, 0, 0]);
    assert.equal(week[1].inspections[0].id, "a");
  });

  test("an inspection with no date is not in any week", () => {
    const week = diaryWeek([inspection("a", null, "1 A St, Oran Park")], "2026-08-24", "2026-08-26");
    assert.equal(week.reduce((n, d) => n + d.inspections.length, 0), 0);
  });

  // The point of the week view: two jobs in one suburb on one day are
  // one trip, which reading down a date-sorted list never shows.
  test("two visits to the same suburb on one day are flagged as a run", () => {
    const week = diaryWeek(
      [
        inspection("a", "2026-08-25", "1 A St, Oran Park"),
        inspection("b", "2026-08-25", "9 B Rd, Oran Park NSW 2570"),
        inspection("c", "2026-08-25", "3 C Ave, Penrith"),
      ],
      "2026-08-24",
      "2026-08-26",
    );
    assert.deepEqual(week[1].runs, [{ suburb: "Oran Park", count: 2 }]);
  });

  test("one visit to a suburb is not a run", () => {
    const week = diaryWeek([inspection("a", "2026-08-25", "1 A St, Oran Park")], "2026-08-24", "2026-08-26");
    assert.deepEqual(week[1].runs, []);
  });

  test("same suburb on different days is two trips, not one", () => {
    const week = diaryWeek([inspection("a", "2026-08-25", "1 A St, Oran Park"), inspection("b", "2026-08-26", "9 B Rd, Oran Park")], "2026-08-24", "2026-08-26");
    assert.deepEqual(week[1].runs, []);
    assert.deepEqual(week[2].runs, []);
  });

  test("a passed date with no outcome is overdue; one with an outcome is done", () => {
    const rows = [
      inspection("a", "2026-08-20", "1 A St, Oran Park"),
      inspection("b", "2026-08-21", "2 B St, Penrith", "passed"),
      inspection("c", "2026-08-26", "3 C St, Penrith"),
      inspection("d", "2026-08-27", "4 D St, Penrith"),
    ];
    assert.deepEqual(overdueInspections(rows, "2026-08-26").map((i) => i.id), ["a"], "today is not overdue");
  });
});
