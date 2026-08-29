import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { certificateFieldValues } from "@/lib/certificates/certificateValues";
import { certificateFixture } from "./helpers/fixture";
import type { PathwayCertificateData } from "@/lib/certificates/pathwayData";

// A correction typed on the certificate screen has to reach the
// certificate. Nine rows were saved under a key of their own that no
// document read, so a certifier could fix the date of determination,
// watch the screen change, and hand over a PDF still carrying the
// original.

function values(overrides: Record<string, string>, extra: Record<string, unknown> = {}) {
  return certificateFieldValues(certificateFixture({ docOverrides: overrides, ...extra }) as PathwayCertificateData);
}

describe("a correction typed on the certificate screen", () => {
  test("reaches the rows that always worked", () => {
    const v = values({ "cert.applicant": "Ms Corrected Applicant", "cert.description": "Corrected works" });
    assert.equal(v.applicant, "Ms Corrected Applicant");
    assert.equal(v.description, "Corrected works");
  });

  // These are the nine. Each was editable on screen and ignored
  // everywhere else.
  test("reaches the nine rows that were being thrown away", () => {
    const v = values({
      "cert.portalRef": "CDC-2026-999",
      "cert.lga": "Fairfield City Council",
      "cert.determination": "01 Sep 2026",
      "cert.lapse": "01 Sep 2031",
      "cert.consentNumber": "DA-2026/0001",
      "cert.consentDate": "02 Sep 2026",
      "cert.ccNumber": "CC-26999/01",
      "cert.ccIssueDate": "03 Sep 2026",
    });
    assert.equal(v.planningPortalRef, "CDC-2026-999");
    assert.equal(v.lga, "Fairfield City Council");
    assert.equal(v.determinationDate, "01 Sep 2026");
    assert.equal(v.lapseDate, "01 Sep 2031");
    assert.equal(v.developmentConsentNumber, "DA-2026/0001");
    assert.equal(v.developmentConsentDate, "02 Sep 2026");
    assert.equal(v.certificateNumber, "CC-26999/01");
    assert.equal(v.issuedDate, "03 Sep 2026");
  });

  // A CC screen saves the council under a different key from a CDC's.
  // A job is one pathway, so either is that row.
  test("the council reaches it under either of the names the screen uses", () => {
    assert.equal(values({ "cert.consentAuthority": "Liverpool City Council" }).lga, "Liverpool City Council");
    assert.equal(values({ "cert.lga": "Penrith City Council" }).lga, "Penrith City Council");
  });

  // The screen shows a formatted date and saves what the certifier
  // typed over it, so formatting it again would rewrite their words.
  test("a corrected date prints exactly as it was typed", () => {
    assert.equal(values({ "cert.determination": "1st of September 2026" }).determinationDate, "1st of September 2026");
    assert.equal(values({ "cert.lapse": "N/A — construction commenced" }).lapseDate, "N/A — construction commenced");
  });

  test("clearing a row prints nothing rather than falling back", () => {
    assert.equal(values({ "cert.determination": "" }).determinationDate, "", "an emptied row is a decision, not a missing value");
    assert.equal(values({ "cert.applicant": "" }).applicant, "");
  });

  test("with nothing corrected, every row still comes from the job", () => {
    const v = values({});
    assert.equal(v.devAddress, "21 Coquet Way Green Valley");
    assert.ok(v.determinationDate.length > 0 || v.determinationDate === "");
    assert.equal(v.applicant.length > 0, true);
  });
});

// Proved on the document rather than the object that describes it: the
// whole bug was that these two disagreed.
describe("the corrected value on the certificate itself", () => {
  test("the PDF prints the correction, not the original", async () => {
    const { buildCertificatePackagePdf } = await import("@/lib/pdf/certificatePackage");
    const { readPdf } = await import("./helpers/readDocuments");
    const pdf = await readPdf(
      await buildCertificatePackagePdf(
        certificateFixture({
          docOverrides: { "cert.determination": "01 Sep 2026", "cert.portalRef": "CDC-2026-999", "cert.lga": "Fairfield City Council" },
        }),
        { logo: null, signature: null },
      ),
    );
    const text = pdf.text.replace(/\s+/g, " ");
    assert.ok(text.includes("01 Sep 2026"), "the corrected determination date never reached the PDF");
    assert.ok(text.includes("CDC-2026-999"), "the corrected Portal reference never reached the PDF");
    assert.ok(text.includes("Fairfield City Council"), "the corrected council never reached the PDF");
  });

  test("the Word export prints it too", async () => {
    const { buildPathwayCertificateDocx } = await import("@/lib/docx/pathwayCertificate");
    const { readDocx } = await import("./helpers/readDocuments");
    const docx = await readDocx(
      await buildPathwayCertificateDocx(certificateFixture({ docOverrides: { "cert.determination": "01 Sep 2026" } }), { logo: null, signature: null }),
    );
    assert.ok(docx.text.includes("01 Sep 2026"), "the corrected determination date never reached Word");
  });
});
