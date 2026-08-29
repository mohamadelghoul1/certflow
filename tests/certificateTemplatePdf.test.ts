import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { certificateFixture } from "./helpers/fixture";
import { readPdf } from "./helpers/readDocuments";
import { DEFAULT_TEMPLATES, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";
import { buildPathwayCertificateDocx } from "@/lib/docx/pathwayCertificate";
import { readDocx } from "./helpers/readDocuments";

// A firm's own layout, proved on the certificate itself rather than on
// the object that describes it. If a template can be edited but the PDF
// ignores it, everything above this is decoration.

// The certificate page itself, not the whole package. Some of these
// labels legitimately appear again in the inspections notice and the
// pre-inspection report, which are not the template's to change — so a
// test reading the whole document would pass for the wrong reason.
async function certificateText(template: CertificateTemplate) {
  const pdf = await readPdf(await buildCertificatePackagePdf(certificateFixture({ template }), { logo: null, signature: null }));
  const start = pdf.pages.findIndex((p) => p.includes("APPLICANT DETAILS"));
  assert.ok(start >= 0, "the certificate page was not found in the package");
  // Two pages, because a firm that adds enough rows pushes the closing
  // section onto a second one — which is the layout working, not
  // breaking: that block is reserved whole rather than split across a
  // page with its heading left behind.
  return pdf.pages.slice(start, start + 2).join(" ").replace(/\s+/g, " ");
}

describe("a firm's own certificate layout", () => {
  test("the default prints the rows it always has", async () => {
    const text = await certificateText(DEFAULT_TEMPLATES.CDC);
    for (const label of ["APPLICANT DETAILS", "OWNER DETAILS", "PROPOSAL", "REGISTERED CERTIFIER", "Land Use Zone:", "Date of Lapse:"]) {
      assert.ok(text.includes(label), `the default certificate lost "${label}"`);
    }
  });

  test("a row the firm removed is off the certificate", async () => {
    const without: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.source !== "zone") })),
    };
    const text = await certificateText(without);
    assert.ok(!text.includes("Land Use Zone:"), "a removed row still printed");
    // and nothing else went with it
    assert.ok(text.includes("BCA/NCC Version:") && text.includes("Date of Lapse:"));
  });

  test("a row the firm added prints, with their own wording", async () => {
    const withExtra: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) =>
        s.heading === "PROPOSAL" ? { ...s, rows: [...s.rows, { source: "fixed" as const, label: "Bushfire Attack Level:", fixedValue: "BAL-12.5" }] } : s,
      ),
    };
    const text = await certificateText(withExtra);
    assert.ok(text.includes("Bushfire Attack Level:"), "the added label did not print");
    assert.ok(text.includes("BAL-12.5"), "the added value did not print");
  });

  test("a label the firm renamed prints their name for it, filled from the same job data", async () => {
    const renamed: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.source === "devAddress" ? { ...r, label: "Site address:" } : r)),
      })),
    };
    const text = await certificateText(renamed);
    assert.ok(text.includes("Site address:"), "the renamed label did not print");
    assert.ok(!text.includes("Address of Development:"), "the old label printed as well");
    assert.ok(text.includes("21 Coquet Way"), "the renamed row lost its value");
  });

  test("a section the firm added prints as its own heading", async () => {
    const withSection: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: [
        ...DEFAULT_TEMPLATES.CDC.sections.slice(0, -1),
        { heading: "FIRE SAFETY", rows: [{ source: "fixed" as const, label: "Schedule:", fixedValue: "Not applicable" }] },
        ...DEFAULT_TEMPLATES.CDC.sections.slice(-1),
      ],
    };
    const text = await certificateText(withSection);
    assert.ok(text.includes("FIRE SAFETY"), "the added section did not print");
    assert.ok(text.includes("Not applicable"), "the added section printed no rows");
    assert.ok(text.includes("REGISTERED CERTIFIER"), "the section after it went missing");
  });

  // Reordering is the point of a template: a firm that wants the proposal
  // before the applicant should get it.
  test("sections print in the firm's order", async () => {
    const reordered: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: [DEFAULT_TEMPLATES.CDC.sections[3], ...DEFAULT_TEMPLATES.CDC.sections.filter((_, i) => i !== 3)],
    };
    const text = await certificateText(reordered);
    assert.ok(text.indexOf("PROPOSAL") < text.indexOf("APPLICANT DETAILS"), "the reordered section did not move");
  });
});

// The Word export is the same certificate, edited before it goes out. If
// it ignored the template a firm would customise their PDF and hand over
// a Word file that disagreed with it.
describe("the Word export follows the same layout", () => {
  test("a renamed label and an added row reach the .docx", async () => {
    const template: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) =>
        s.heading === "PROPOSAL"
          ? {
              ...s,
              rows: [
                ...s.rows.map((r) => (r.source === "devAddress" ? { ...r, label: "Site address:" } : r)),
                { source: "fixed" as const, label: "Bushfire Attack Level:", fixedValue: "BAL-12.5" },
              ],
            }
          : s,
      ),
    };
    const text = (await readDocx(await buildPathwayCertificateDocx(certificateFixture({ template }), { logo: null, signature: null }))).text.replace(/\s+/g, " ");
    assert.ok(text.includes("Site address:"), "the renamed label did not reach Word");
    assert.ok(text.includes("Bushfire Attack Level:") && text.includes("BAL-12.5"), "the added row did not reach Word");
  });

  test("a row the firm dropped is off the .docx too", async () => {
    const without: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.source !== "zone") })),
    };
    const text = (await readDocx(await buildPathwayCertificateDocx(certificateFixture({ template: without }), { logo: null, signature: null }))).text;
    assert.ok(!text.includes("Land Use Zone:"), "a removed row still printed in Word");
  });
});
