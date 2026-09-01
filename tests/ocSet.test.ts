import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildOcPackagePdf } from "@/lib/pdf/ocPackage";
import { inspectionsForSet } from "@/lib/pdf/ocSet";
import { ocCertificateFixture } from "./helpers/fixture";
import { readPdf } from "./helpers/readDocuments";

async function packageText(overrides: Record<string, unknown> = {}) {
  const bytes = await buildOcPackagePdf(ocCertificateFixture(overrides), { logo: null, signature: null });
  const { text, pageCount } = await readPdf(bytes);
  return { text: text.replace(/\s+/g, " "), pageCount };
}

describe("the Occupation Certificate package", () => {
  // The PDF twin of the Word export: it exists so the issued set can be
  // one file, so it has to say the same things section for section.
  test("carries both letters and the certificate", async () => {
    const { text, pageCount } = await packageText();
    // Two letters, the certificate (whose determination and signature run
    // to a second page when the rows fill the first), then Schedule 1 on
    // a page of its own — the same shape as the practice's own OCs.
    assert.equal(pageCount, 5);
    assert.ok(text.includes("The General Manager"));
    assert.ok(text.includes("Liverpool City Council"));
    assert.ok(text.includes("Anh Cao"), "the applicant's letter is addressed to them");
    assert.ok(text.includes("OCCUPATION CERTIFICATE - WHOLE - CDC-26001/01"));
    assert.ok(text.includes("Issued under Part 6 of the Environmental Planning and Assessment Act 1979"));
    assert.ok(text.includes("Sections 6.9, 6.10"), "the letters cite the sections an OC is issued under");
    assert.ok(text.includes("9 / DP253031"));
    assert.ok(text.includes("Class 1a"));
    assert.ok(text.includes("DETERMINATION"));
    assert.ok(text.includes("I, Mohamad El Ghoul, as the certifying authority, certify that:"));
    assert.ok(text.includes("suitable for occupation or use in accordance with its Classification"));
    assert.ok(text.includes("Principal Certifier / BDC2961"), "OC letters go out over the Principal Certifier's title");
  });

  // A whole OC ends the job: no conditions section, and the letter says
  // thank you rather than starting a five-year clock.
  test("a whole OC carries no conditions and thanks the client", async () => {
    const { text } = await packageText();
    assert.ok(!text.includes("CONDITIONS OF OCCUPATION CERTIFICATE"));
    assert.ok(!text.includes("s 6.33(1)"));
    assert.ok(text.includes("thank you for using our services"));
  });

  // What the certificate relies on is the whole point of the schedule —
  // an OC that does not list its documents is not evidence of anything.
  test("lists the documents relied upon under Schedule 1", async () => {
    const { text } = await packageText();
    assert.ok(text.includes("SCHEDULE 1: DOCUMENTATION REQUIRED TO ISSUE OCCUPATION CERTIFICATE CDC-26001/01"));
    assert.ok(text.includes("Structural engineer's certificate"));
    assert.ok(text.includes("Studio North"));
    assert.ok(text.includes("SE-01"));
    assert.ok(text.includes("Waterproofing certificate"));
  });

  // A partial OC is a certificate with a clock on it: clause 53's
  // five-year condition on the certificate, the same warning in the
  // applicant's letter, and what is excluded said in its own row.
  test("a partial OC carries the five-year condition, its exclusions and the extra declaration", async () => {
    const { text } = await packageText({
      record: {
        id: "oc-2",
        type: "partial",
        description: "Ground floor only",
        exclusions: "This Occupation Certificate excludes the swimming pool.",
        generated_date: "2026-08-24",
        approval_uploaded: false,
        approval_file_path: null,
      },
      ref: "CC-25191",
      typeLabel: "Partial Occupation Certificate",
      daNumber: "DA-2025/0123",
      daDate: "12 Mar 2025",
    });
    assert.ok(text.includes("OCCUPATION CERTIFICATE - PARTIAL - CC-25191"));
    assert.ok(text.includes("Ground floor only"));
    assert.ok(text.includes("CONDITIONS OF OCCUPATION CERTIFICATE"));
    assert.ok(text.includes("s 6.33(1)"));
    assert.ok(text.includes("within 5 years"));
    assert.ok(text.includes("Exclusions:"));
    assert.ok(text.includes("excludes the swimming pool"));
    assert.ok(text.includes("health and safety of the occupants"), "the partial's extra declaration");
    assert.ok(text.includes("A fee will apply"), "the applicant letter warns about the second OC");
    assert.ok(text.includes("Development Consent Number:"));
    assert.ok(text.includes("DA-2025/0123"));
    assert.ok(text.includes("12 Mar 2025"));
  });

  // A certificate with nothing approved against it still has to produce a
  // document rather than throw.
  test("survives an OC with no approved documents", async () => {
    const { text } = await packageText({ approvedItems: [] });
    assert.ok(text.includes("No approved documents."));
  });
});

describe("which inspection reports go into the set", () => {
  const inspections = [
    { id: "a", title: "Frame", date: "2026-06-02", sort_order: 3 },
    { id: "b", title: "Final", date: "2026-08-20", sort_order: 9 },
    // Booked but never carried out — nothing to report.
    { id: "c", title: "Waterproofing", date: null, sort_order: 5 },
    { id: "d", title: "Slab steel", date: "2026-06-02", sort_order: 1 },
  ];

  test("takes the ones that happened, in the order they happened", () => {
    assert.deepEqual(
      inspectionsForSet(inspections).map((i) => i.id),
      ["d", "a", "b"]
    );
  });

  test("leaves out an inspection that was never carried out", () => {
    assert.ok(!inspectionsForSet(inspections).some((i) => i.id === "c"));
  });
});

// The composition itself: the certificate leads, the checklist documents
// follow, and the inspection reports come in behind them. This is the
// order the certifier asked for and the order a reader expects — the
// certificate, what it relied on, then the evidence from site.
describe("the combined set", () => {
  test("puts the certificate first, then the documents, then the reports", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const { buildApprovalBundle } = await import("@/lib/pdf/bundle");
    const { buildInspectionReportPdf } = await import("@/lib/pdf/inspectionReport");
    const { inspectionReportFixture } = await import("./helpers/fixture");

    async function onePager(text: string) {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage([595.28, 841.89]).drawText(text, { x: 60, y: 700, size: 14, font });
      return doc.save();
    }

    const certificate = await buildOcPackagePdf(ocCertificateFixture(), { logo: null, signature: null });
    const checklistDoc = await onePager("Structural engineers certificate");
    const report = await buildInspectionReportPdf(inspectionReportFixture(), { logo: null, signature: null, photos: [] });

    const bytes = await buildApprovalBundle({
      heading: "Whole Occupation Certificate CDC-26001/01 — issued set",
      subheading: "21 Coquet Way Green Valley",
      approval: { bytes: certificate, contentType: "application/pdf" },
      approvalLabel: "Whole Occupation Certificate — letters and certificate",
      documents: [
        { title: "Structural engineer's certificate", bytes: checklistDoc, contentType: "application/pdf" },
        { title: "Inspection report — Slab Steel", bytes: report, contentType: "application/pdf" },
      ],
      stampDetails: { firmName: "", certRef: "", pathway: "", certifierName: "", registrationNo: "", date: "" },
    });

    const { pages } = await readPdf(bytes);
    const find = (needle: string) => pages.findIndex((page) => page.replace(/\s+/g, " ").includes(needle));
    const certificatePage = find("OCCUPATION CERTIFICATE - WHOLE");
    const documentPage = find("Structural engineers certificate");
    const reportPage = find("Slab Steel");

    assert.ok(certificatePage >= 0 && documentPage >= 0 && reportPage >= 0, "everything made it into the set");
    assert.ok(certificatePage < documentPage, "the certificate leads");
    assert.ok(documentPage < reportPage, "the inspection reports come in behind the documents");
    // No closing page: nothing was left out, so the set is exactly what
    // went into it.
    assert.ok(!pages.some((page) => page.includes("Not included in this set")));
  });
});
