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
  // An inspection on a job with a modified certificate stands under both
  // certificates, so the title names them all — the original and each
  // modification — the way the CDC/CC Number row always has.
  test("the title carries every certificate issued for the job", async () => {
    const both = { titleRefs: "CDC-26001/01, CDC-26001/02", certNumbers: "CDC-26001/01, CDC-26001/02" };
    assert.ok((await pdf(both)).text.includes("INSPECTION REPORT – CDC-26001/01, CDC-26001/02"));
    assert.ok((await docx(both)).includes("INSPECTION REPORT – CDC-26001/01, CDC-26001/02"));
  });

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

describe("the re-inspection column", () => {
  // It used to read "No re-inspection required, subject to
  // documents/conditions being provided" — repeating a condition that
  // already sits in the outcome beside it, and reading as though the
  // re-inspection itself were the conditional part.
  test("says only that no re-inspection is required, on both satisfactory outcomes", async () => {
    for (const outcome of ["passed", "passed_subject_to"] as const) {
      const { text } = await pdf({ inspection: { ...inspectionReportFixture().inspection, outcome } });
      assert.ok(text.includes("No re-inspection required"), `${outcome} says no re-inspection is required`);
      assert.ok(!text.includes("No re-inspection required, subject to"), `${outcome} no longer trails the condition`);
      assert.ok(!text.includes("No re-inspections required for this inspection"), `${outcome} no longer uses the old fallback wording`);
    }
  });

  test("keeps the condition in the outcome itself", async () => {
    const { text } = await pdf({ inspection: { ...inspectionReportFixture().inspection, outcome: "passed_subject_to" } });
    assert.ok(text.includes("Satisfactory (minor issues) subject to documents/conditions being provided"));
  });

  test("a failed inspection still calls for one", async () => {
    const { text } = await pdf({ inspection: { ...inspectionReportFixture().inspection, outcome: "failed" } });
    assert.ok(text.includes("Re-inspection required"));
  });

  // The screen, the Word export and the PDF all read the same wording, so
  // a change to one can't leave the other two behind.
  test("the Word export words it identically", async () => {
    const text = await docx({ inspection: { ...inspectionReportFixture().inspection, outcome: "passed_subject_to" } });
    assert.ok(text.includes("No re-inspection required"));
    assert.ok(!text.includes("No re-inspection required, subject to"));
  });
});

// A PC/OC job issues no certificate of its own — the inspections are
// carried out under the CDC or CC another certifier issued. The report's
// consents section names that certificate, the way it names the job's own
// on a CDC or CC job.
describe("the consents section on a PC/OC job", () => {
  const pcOc = {
    job: { ...inspectionReportFixture().job, pathway: "PC_OC" },
    certNumbers: "CDC-26091/01",
    certTypeLabel: "Complying Development Certificate",
  };

  test("prints the original certificate's number under the Local Government Area", async () => {
    for (const [format, text] of [
      ["PDF", (await pdf(pcOc)).text],
      ["Word", await docx(pcOc)],
    ] as const) {
      assert.ok(text.includes("Local Government Area:"), `${format} lost the LGA row`);
      assert.ok(text.includes("Complying Development Certificate Number"), `${format} does not label the original certificate`);
      assert.ok(text.includes("CDC-26091/01"), `${format} does not print the original certificate's number`);
    }
  });

  test("labels it a Construction Certificate when that is what was issued", async () => {
    const { text } = await pdf({ ...pcOc, certNumbers: "CFT-123456", certTypeLabel: "Construction Certificate" });
    assert.ok(text.includes("Construction Certificate Number"));
    assert.ok(text.includes("CFT-123456"));
  });
});
