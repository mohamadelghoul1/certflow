import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { OcCertificateRows } from "@/components/certifier/OcCertificateRows";
import { ocCertificateFixture } from "./helpers/fixture";
import { DEFAULT_TEMPLATES, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";

// The screen is where an Occupation Certificate is checked before it is
// handed over. Its PDF and its Word export both followed the firm's own
// layout; the screen drew a fixed one of its own, so a firm that changed
// its OC would have checked one document and issued another.

function screen(template: CertificateTemplate) {
  const html = renderToStaticMarkup(<OcCertificateRows data={ocCertificateFixture({ template })} />);
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

const OC = DEFAULT_TEMPLATES.OC;

describe("the Occupation Certificate on screen", () => {
  test("draws the standard layout when the firm has not changed it", () => {
    const text = screen(OC);
    for (const label of ["Property address:", "Lot/Section/DP:", "Development description:", "Building classification(s):", "Date of issue:"]) {
      assert.ok(text.includes(label), `the screen lost "${label}"`);
    }
  });

  test("a row the firm dropped is off the screen, as it is off the PDF", () => {
    const without: CertificateTemplate = {
      ...OC,
      sections: OC.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.source !== "bcaClass") })),
    };
    const text = screen(without);
    assert.ok(!text.includes("Building classification(s):"), "a removed row still showed on screen");
    assert.ok(text.includes("Property address:"), "removing one row should not remove the rest");
  });

  test("a row the firm renamed is renamed on the screen too", () => {
    const renamed: CertificateTemplate = {
      ...OC,
      sections: OC.sections.map((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.source === "devAddress" ? { ...r, label: "Site address:" } : r)),
      })),
    };
    const text = screen(renamed);
    assert.ok(text.includes("Site address:"), "the firm's own wording did not reach the screen");
    assert.ok(!text.includes("Property address:"), "the old wording was still drawn");
  });

  test("a row and a section the firm added show on screen", () => {
    const added: CertificateTemplate = {
      ...OC,
      sections: [...OC.sections, { heading: "FIRE SAFETY", rows: [{ source: "fixed" as const, label: "Schedule:", fixedValue: "Not applicable" }] }],
    };
    const text = screen(added);
    assert.ok(text.includes("FIRE SAFETY"), "an added section heading did not show");
    assert.ok(text.includes("Schedule:") && text.includes("Not applicable"), "an added row did not show");
  });

  // A CDC job has no development consent behind it. Those rows are marked
  // to drop when empty, and the screen must drop them like the PDF does
  // rather than printing a label with nothing beside it.
  test("a row with nothing to say is left out rather than printed empty", () => {
    const text = renderToStaticMarkup(
      <OcCertificateRows data={ocCertificateFixture({ template: OC, daNumber: "", daDate: "" })} />
    ).replace(/<[^>]+>/g, " ");
    assert.ok(!text.includes("Development Consent (DA) No.:"), "an empty consent row was drawn anyway");
  });
});
