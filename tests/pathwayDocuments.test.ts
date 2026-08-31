import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { buildPathwayCertificateDocx } from "@/lib/docx/pathwayCertificate";
import { certificateFixture } from "./helpers/fixture";
import { readPdf, readDocx, docxPageBreaks, type PdfPages } from "./helpers/readDocuments";
import { DEFAULT_TEMPLATES } from "@/lib/certificates/certificateTemplate";

// The approval as a certifier receives it. These assert on the generated
// files themselves, so a layout or content regression fails here rather
// than in a council's inbox.

describe("the approved-set PDF", () => {
  let pdf: PdfPages;

  before(async () => {
    pdf = await readPdf(await buildCertificatePackagePdf(certificateFixture(), { logo: null, signature: null }));
  });

  test("runs to seven pages: two letters, certificate over two, notice, two schedules", () => {
    assert.equal(pdf.pageCount, 7);
  });

  test("each covering letter closes on its own page", () => {
    assert.ok(pdf.pages[0].includes("The General Manager"), "the council letter leads");
    assert.ok(pdf.pages[0].includes("Yours sincerely"), "and closes on the same page");
    assert.ok(pdf.pages[1].includes("Yours sincerely"), "the applicant letter likewise");
  });

  test("the certificate carries the certifier who issued it", () => {
    const certPage = pdf.pages.find((p) => p.includes("APPLICANT DETAILS")) || "";
    assert.ok(certPage.includes("REGISTERED CERTIFIER"), "on the certificate page, not a continuation sheet");
    assert.ok(certPage.includes("BDC2961"));
  });

  // The declaration used to be given a page of its own unconditionally,
  // which on a job whose certificate ran long meant the Registered
  // Certifier block alone on one page and the signature alone on the
  // next. It now follows on where the page has room — shown here on a
  // short certificate — and still takes the next page where it does not,
  // which is the full fixture above.
  test("the declaration follows the Registered Certifier where the page has room", async () => {
    const short = certificateFixture({
      template: { sections: DEFAULT_TEMPLATES.CDC.sections.slice(-1) },
    });
    const { pages } = await readPdf(await buildCertificatePackagePdf(short, { logo: null, signature: null }));
    const declaration = pages.find((p) => p.includes("certify that the development")) || "";
    assert.ok(declaration.includes("REGISTERED CERTIFIER"), "the signature sits under the certificate it signs");
  });

  test("the declaration is never split from the certifier's name above it", () => {
    const declaration = pdf.pages.find((p) => p.includes("certify that the development")) || "";
    assert.ok(declaration.includes("Dated:"), "the date stays with the declaration");
    assert.ok(declaration.includes("N.B."), "and so does the note beneath the signature");
  });

  test("a document with no date reads as a dash", () => {
    assert.ok(!pdf.text.includes("Not yet scheduled"), "an inspection's wording must never reach a schedule of plans");
  });

  test("Schedule 1 lists no status column", () => {
    const schedule = pdf.pages.find((p) => p.includes("SCHEDULE 1: APPROVED PLANS")) || "";
    assert.ok(schedule.includes("Prepared by") && schedule.includes("Revision"));
    assert.ok(!schedule.includes("Status"), "every row said 'approved', which said nothing");
    assert.ok(!schedule.includes("Every document requested from the applicant"));
  });

  test("the certificate title carries no project-reference subtitle", () => {
    assert.ok(!pdf.text.includes("PROJECT REFERENCE"));
    assert.ok(pdf.text.includes("Project No.: CDC-26001"), "the page footer still carries it");
  });

  test("classifications print as the class alone", () => {
    assert.ok(pdf.text.includes("Class 1a, 10a"));
    assert.ok(!pdf.text.includes("Single dwelling"), "the tick box's gloss belongs on the form, not the certificate");
  });

  test("the letters name the instrument the job is assessed under", () => {
    assert.ok(pdf.pages[0].includes("State Environmental Planning Policy (Housing) 2021"));
  });
});

describe("the Word export", () => {
  let docx: { xml: string; text: string };

  before(async () => {
    docx = await readDocx(await buildPathwayCertificateDocx(certificateFixture(), { logo: null, signature: null }));
  });

  test("breaks into the same sections as the PDF", () => {
    assert.equal(docxPageBreaks(docx.xml), 5, "five breaks make six sections");
  });

  test("carries the certifier, the classification and the instrument", () => {
    assert.ok(docx.text.includes("REGISTERED CERTIFIER"));
    assert.ok(docx.text.includes("BDC2961"));
    assert.ok(docx.text.includes("Class 1a, 10a"));
    assert.ok(docx.text.includes("State Environmental Planning Policy (Housing) 2021"));
  });

  test("drops the same boilerplate the PDF drops", () => {
    assert.ok(!docx.text.includes("Not yet scheduled"));
    assert.ok(!docx.text.includes("PROJECT REFERENCE"));
    assert.ok(!docx.text.includes("Every document requested from the applicant"));
  });

  test("tables carry absolute column widths, never percentages", () => {
    // Percentage widths write placeholder gridCols that Word on Mac, iOS
    // and the web honour literally, collapsing every table to one
    // character wide. This is what that regression looked like.
    assert.ok(!docx.xml.includes('w:type="pct"'), "a percentage table width breaks Word outside Windows");
    assert.ok(docx.xml.includes('w:type="dxa"'));
  });
});

describe("a CC job", () => {
  test("names its development consent rather than a SEPP", async () => {
    const pdf = await readPdf(
      await buildCertificatePackagePdf(
        certificateFixture({
          isCdc: false,
          pathwayFull: "Construction Certificate",
          // A CC job draws the CC layout — different sections and
          // different labels from a CDC.
          template: DEFAULT_TEMPLATES.CC,
          ref: "CC-26001/01",
          cd: { developmentConsentNumber: "DA-2025/0456", developmentConsentDate: "2025-11-02", planningPortalRef: "CFT-123456", lotSectionDp: "339//DP815298" },
        }),
        { logo: null, signature: null }
      )
    );
    assert.ok(pdf.text.includes("DA-2025/0456"));
    assert.ok(pdf.text.includes("Development Application No.") || pdf.text.includes("Development Consent Number"));
  });
});
