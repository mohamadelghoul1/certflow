import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildInspectionReportPdf } from "@/lib/pdf/inspectionReport";
import { buildInspectionReportDocx } from "@/lib/docx/inspectionReport";
import { inspectionReportFixture } from "./helpers/fixture";
import { readPdf, readDocx } from "./helpers/readDocuments";

async function pdf(overrides: Record<string, unknown> = {}) {
  const bytes = await buildInspectionReportPdf(inspectionReportFixture(overrides), { logo: null, signature: null, photos: [] });
  const { pages, text } = await readPdf(bytes);
  return { pages, text: text.replace(/\s+/g, " ") };
}

async function docx(overrides: Record<string, unknown> = {}) {
  const buffer = await buildInspectionReportDocx(inspectionReportFixture(overrides), { logo: null, signature: null, photos: [] });
  return (await readDocx(buffer)).text.replace(/\s+/g, " ");
}

describe("the inspection report", () => {
  // It used to read "Not yet scheduled" — the wording an inspection list
  // uses for a visit not yet booked, which on a report of a visit that has
  // already happened is nonsense. It appeared in two places.
  test("leaves the date out entirely when none is recorded", async () => {
    for (const [format, text] of [
      ["PDF", (await pdf({ inspection: { ...inspectionReportFixture().inspection, date: null } })).text],
      ["Word", await docx({ inspection: { ...inspectionReportFixture().inspection, date: null } })],
    ] as const) {
      assert.ok(!text.includes("Not yet scheduled"), `${format} still says "Not yet scheduled"`);
      assert.ok(!text.includes("Inspection date:"), `${format} still prints an empty date row`);
    }
  });

  test("shows the date when there is one", async () => {
    const { text } = await pdf();
    assert.ok(text.includes("Inspection date:"));
    assert.ok(text.includes("20 Aug 2026"));
  });

  // The issues are a record of what was found on the day, not a checklist
  // worked through in the app — so nothing on the report is marked
  // resolved, and nothing waits on rectification.
  test("lists the issues without marking any of them resolved", async () => {
    const { text } = await pdf();
    assert.ok(text.includes("structural engineer"));
    assert.ok(text.includes("Termite barrier installation"));
    assert.ok(!/\bResolved\b/.test(text), "an issue is never shown as resolved, even when the row says it is");
  });

  test("says so plainly when there are no issues", async () => {
    const { text } = await pdf({ inspection: { ...inspectionReportFixture().inspection, defects: [] } });
    assert.ok(text.includes("No further documents are required."));
  });

  test("carries the same letterhead and project footer as the certificate", async () => {
    const { text } = await pdf();
    assert.ok(text.includes("Quality Private Certifiers"));
    assert.ok(text.includes("ABN: 41 630 945 416"));
    assert.ok(text.includes("Project No.: CDC-26001/01"));
  });

  test("is one page when there are no photos to attach", async () => {
    const { pages } = await pdf();
    assert.equal(pages.length, 1, "the photo page is added only when there are photos");
  });
});
