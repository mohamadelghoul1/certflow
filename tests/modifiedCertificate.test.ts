import { test, before, describe } from "node:test";
import assert from "node:assert/strict";
import { modificationReasonSentence } from "@/lib/certificates/pathwayData";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { buildPathwayCertificateDocx } from "@/lib/docx/pathwayCertificate";
import { certificateFixture } from "./helpers/fixture";
import { readPdf, readDocx, type PdfPages } from "./helpers/readDocuments";

// A modified CDC's council letter names itself as one — the reference
// line reads "Section 4.30 Modification" and the body says a Modified
// certificate was issued and why. These are the fields as
// getPathwayCertificateData resolves them for a version beyond the
// first.
function modifiedFixture() {
  return certificateFixture({
    ref: "CDC-26001/02",
    isModification: true,
    modificationReason: "This modification reflects changes to the floor plan layout and window schedule.",
    councilCertLabel: "Section 4.30 Modification – Complying Development Certificate No.:",
    councilBody: [
      "Quality Private Certifiers Pty Ltd has issued a Modified Complying Development Certificate under Part 4 of the Environmental Planning and Assessment Act 1979 for the above premises.",
      "This modification reflects changes to the floor plan layout and window schedule.",
      "Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor Mohamad El Ghoul.",
    ],
  });
}

describe("the sentence built from a modification's reason", () => {
  test("a typed phrase becomes the letter's sentence", () => {
    assert.equal(
      modificationReasonSentence("Changes to the floor plan layout and window schedule"),
      "This modification reflects changes to the floor plan layout and window schedule."
    );
  });

  test("a reason already written as the sentence is kept as typed", () => {
    assert.equal(
      modificationReasonSentence("This modification reflects an amended window schedule."),
      "This modification reflects an amended window schedule."
    );
  });

  test("an acronym keeps its capitals", () => {
    assert.equal(modificationReasonSentence("BASIX commitments updated"), "This modification reflects BASIX commitments updated.");
  });

  test("a full stop is added once and only once", () => {
    assert.equal(modificationReasonSentence("changes to the garage."), "This modification reflects changes to the garage.");
  });

  test("no reason typed means no sentence", () => {
    assert.equal(modificationReasonSentence(""), null);
    assert.equal(modificationReasonSentence("   "), null);
    assert.equal(modificationReasonSentence(null), null);
  });
});

describe("a modified certificate's council letter", () => {
  let pdf: PdfPages;

  before(async () => {
    pdf = await readPdf(await buildCertificatePackagePdf(modifiedFixture(), { logo: null, signature: null }));
  });

  test("the reference line names the section 4.30 modification", () => {
    assert.ok(pdf.pages[0].includes("Section 4.30 Modification"), "on the council letter's reference line");
    assert.ok(pdf.pages[0].includes("CDC-26001/02"), "with the modified certificate's number");
  });

  test("the body says a Modified certificate was issued, and why", () => {
    assert.ok(pdf.pages[0].includes("has issued a Modified Complying Development Certificate"));
    assert.ok(pdf.pages[0].includes("This modification reflects changes to the floor plan layout and window schedule."));
  });

  test("the Word export carries the same reference line and body", async () => {
    const docx = await readDocx(await buildPathwayCertificateDocx(modifiedFixture(), { logo: null, signature: null }));
    assert.ok(docx.text.includes("Section 4.30 Modification"));
    assert.ok(docx.text.includes("has issued a Modified Complying Development Certificate"));
    assert.ok(docx.text.includes("This modification reflects changes to the floor plan layout and window schedule."));
  });

  test("an ordinary first issue says none of it", async () => {
    const plain = await readPdf(await buildCertificatePackagePdf(certificateFixture(), { logo: null, signature: null }));
    assert.ok(!plain.text.includes("Section 4.30"));
    assert.ok(!plain.text.includes("has issued a Modified"));
  });
});
