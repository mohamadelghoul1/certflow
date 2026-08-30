import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PathwayCertificateDocument } from "@/components/certifier/PathwayCertificateDocument";
import { certificateFixture } from "./helpers/fixture";
import { DEFAULT_TEMPLATES, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";

// The screen is where a certificate is checked and corrected before it is
// issued, so it has to be the certificate that gets issued. It drew its
// own fixed layout while the PDF and the Word export drew the firm's, so
// a firm that customised would have checked one document and handed over
// another.

function screen(template: CertificateTemplate, overrides: Record<string, string> = {}) {
  const html = renderToStaticMarkup(<PathwayCertificateDocument data={certificateFixture({ template, docOverrides: overrides })} />);
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

describe("the certificate on screen", () => {
  test("draws the standard layout when the firm has not changed it", () => {
    const text = screen(DEFAULT_TEMPLATES.CDC);
    for (const label of ["APPLICANT DETAILS", "OWNER DETAILS", "PROPOSAL", "REGISTERED CERTIFIER", "Land Use Zone:", "Date of Lapse:"]) {
      assert.ok(text.includes(label), `the screen lost "${label}"`);
    }
  });

  // The firm's name used to have " Pty Ltd" appended to it in code, in
  // twenty-seven places. A firm whose record already carried its full
  // legal name — as it must, now that anything but a Pty Ltd can use
  // Certlyn — would have had it printed twice on every certificate,
  // letter, quote and invoice.
  test("the firm's name is printed as the firm recorded it, once", () => {
    const text = screen(DEFAULT_TEMPLATES.CDC);
    assert.ok(text.includes("Quality Private Certifiers Pty Ltd"), "the firm's name is missing from the certificate");
    assert.equal(text.includes("Pty Ltd Pty Ltd"), false, "the entity type was appended to a name that already carried it");
  });

  test("a row the firm dropped is off the screen, as it is off the PDF", () => {
    const without: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.source !== "zone") })),
    };
    assert.ok(!screen(without).includes("Land Use Zone:"), "a removed row still showed on screen");
  });

  test("a row and a section the firm added show on screen", () => {
    const added: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: [
        ...DEFAULT_TEMPLATES.CDC.sections,
        { heading: "FIRE SAFETY", rows: [{ source: "fixed" as const, label: "Schedule:", fixedValue: "Not applicable" }] },
      ],
    };
    const text = screen(added);
    assert.ok(text.includes("FIRE SAFETY") && text.includes("Schedule:") && text.includes("Not applicable"));
  });

  test("a renamed label shows the firm's name for it", () => {
    const renamed: CertificateTemplate = {
      ...DEFAULT_TEMPLATES.CDC,
      sections: DEFAULT_TEMPLATES.CDC.sections.map((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.source === "devAddress" ? { ...r, label: "Site address:" } : r)),
      })),
    };
    const count = (text: string, needle: string) => text.split(needle).length - 1;
    // The label appears twice on the standard layout: once on the
    // certificate and once on the inspections notice, which is not the
    // template's to change. Renaming the certificate's leaves the
    // notice's alone.
    assert.equal(count(screen(DEFAULT_TEMPLATES.CDC), "Address of Development:"), 2);
    const text = screen(renamed);
    assert.ok(text.includes("Site address:"), "the renamed label is not on screen");
    assert.equal(count(text, "Address of Development:"), 1, "the certificate's own label did not change");
  });

  // The nine rows whose corrections used to go nowhere are edited here.
  test("a correction typed on a previously-ignored row shows on screen", () => {
    const text = screen(DEFAULT_TEMPLATES.CDC, { "cert.determination": "01 Sep 2026", "cert.portalRef": "CDC-2026-999" });
    assert.ok(text.includes("01 Sep 2026"), "the corrected determination date is not on screen");
    assert.ok(text.includes("CDC-2026-999"), "the corrected Portal reference is not on screen");
  });

  test("a CC draws the CC layout, with its own labels", () => {
    const text = screen(DEFAULT_TEMPLATES.CC);
    assert.ok(text.includes("RELEVANT DEVELOPMENT CONSENTS"));
    assert.ok(text.includes("Lot/ DP:"), "the CC's own label for the lot is missing");
    assert.ok(!text.includes("Date of Lapse:"), "a CDC-only row showed on a CC");
  });
});
