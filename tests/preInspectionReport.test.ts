import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPreInspectionReportDocx } from "@/lib/docx/preInspectionReport";
import { preInspectionRows, type PreInspectionData } from "@/lib/certificates/preInspectionData";
import { buildCertificatePackagePdf } from "@/lib/pdf/certificatePackage";
import { buildPreInspectionReportPdf } from "@/lib/pdf/preInspectionReport";
import { readDocx, readPdf } from "./helpers/readDocuments";
import { certificateFixture, preInspectionFixture } from "./helpers/fixture";

async function textOf(isCdc: boolean) {
  return (await readDocx(await buildPreInspectionReportDocx(preInspectionFixture(isCdc), { logo: null, signature: null }))).text;
}

describe("the CDC pre-inspection report", () => {
  test("is made under s139 of the EP&A Regulation 2021", async () => {
    const text = await textOf(true);
    assert.ok(text.includes("139 EP and A Regulation 2021"));
    assert.ok(!text.includes("Development Certification and Fire Safety"), "that is the CC's regulation, not the CDC's");
  });

  test("names its consents as complying development ones", async () => {
    const text = await textOf(true);
    assert.ok(text.includes("COMPLYING DEVELOPMENT CONSENTS"));
    assert.ok(text.includes("CDC Number"));
    assert.ok(!text.includes("Development Applications"), "a CDC is not issued against a DA, so the row is left out entirely");
  });

  test("asks whether the development can be a CDC", async () => {
    const text = await textOf(true);
    assert.ok(text.includes("cannot be a CDC or comply with the BCA"));
  });
});

describe("the CC pre-inspection report", () => {
  test("is made under s16 of the Development Certification and Fire Safety Regulation", async () => {
    const text = await textOf(false);
    assert.ok(text.includes("S16 EP&A (Development Certification and Fire Safety) Regulation 2021"));
  });

  test("names the development application it relies on", async () => {
    const text = await textOf(false);
    assert.ok(text.includes("RELEVANT CONSENTS"));
    assert.ok(text.includes("Development Applications (if applicable)"));
    assert.ok(text.includes("DA-25-01431"));
    assert.ok(text.includes("Construction Certificate Number"));
  });

  test("asks whether the development can be a CC", async () => {
    const text = await textOf(false);
    assert.ok(text.includes("cannot be a CC or comply with the BCA"));
  });
});

describe("both reports", () => {
  test("carry the applicant, the proposal, the inspector and the two dates", async () => {
    for (const isCdc of [true, false]) {
      const text = await textOf(isCdc);
      assert.ok(text.includes("MD Shahidul Karim"), "applicant");
      assert.ok(text.includes("9 / DP253031"), "lot and DP");
      assert.ok(text.includes("R2"), "zoning");
      assert.ok(text.includes("Alterations and additions to a dwelling"), "scope of works");
      assert.ok(text.includes("Mohamad El Ghoul"), "inspector");
      assert.ok(text.includes("BDC2961"), "registration");
      assert.ok(text.includes("09 Dec 2025"), "application date");
      assert.ok(text.includes("20 Jan 2026"), "inspection date");
      assert.ok(text.includes("– Inspector"), "signed by the inspector");
    }
  });

  test("list the four inspection areas with their outcomes", async () => {
    const text = await textOf(true);
    assert.equal(preInspectionRows(true).length, 4);
    assert.ok(text.includes("Details of the current fire safety measures"));
    assert.ok(text.includes("Has any building work commenced?"));
    assert.equal((text.match(/Satisfactory/g) || []).length, 4, "one outcome per area");
  });
});

describe("the pre-inspection report inside the approved set", () => {
  // Which page each named section starts on, so the order can be asserted
  // rather than eyeballed.
  async function sections(preInspection: PreInspectionData | null) {
    const bytes = await buildCertificatePackagePdf(certificateFixture(), { logo: null, signature: null }, preInspection);
    const { pages } = await readPdf(bytes);
    const at = (needle: string) => pages.findIndex((p) => p.replace(/\s+/g, " ").includes(needle));
    return {
      certificate: at("COMPLYING DEVELOPMENT CERTIFICATE"),
      scheduleOne: at("SCHEDULE 1: APPROVED"),
      report: at("INSPECTION REPORT"),
      notice: at("NOTICE TO APPLICANT"),
      pageCount: pages.length,
    };
  }

  test("follows the certificate and its Schedule 1, ahead of the inspections notice", async () => {
    const s = await sections(preInspectionFixture(true));
    assert.ok(s.report > -1, "the report is in the set");
    assert.ok(s.certificate < s.scheduleOne, "the certificate still leads its own Schedule 1");
    assert.ok(s.scheduleOne < s.report, "the report sits under the certificate, not inside it");
    assert.ok(s.report < s.notice, "what was found on site comes before the notice of what is still to be inspected");
  });

  test("costs the set one page and leaves the rest of it alone", async () => {
    const [without, withReport] = await Promise.all([sections(null), sections(preInspectionFixture(true))]);
    assert.equal(without.report, -1, "a job with no dates recorded gets no report");
    assert.equal(withReport.pageCount, without.pageCount + 1);
    assert.equal(withReport.certificate, without.certificate, "nothing ahead of the report moves");
  });

  test("carries the same letterhead and project footer as the certificate", async () => {
    const bytes = await buildCertificatePackagePdf(certificateFixture(), { logo: null, signature: null }, preInspectionFixture(true));
    const { pages } = await readPdf(bytes);
    const page = pages.find((p) => p.includes("INSPECTION REPORT"))!.replace(/\s+/g, " ");
    assert.ok(page.includes("Quality Private Certifiers"));
    assert.ok(page.includes("ABN: 41 630 945 416"));
    assert.ok(page.includes("Project No.: CDC-26001"));
  });
});

describe("the standalone pre-inspection report PDF", () => {
  // Built only when the approval is a signed PDF the certifier uploaded,
  // so there is no generated package to draw the report inside.
  test("is a single page carrying the whole report", async () => {
    const { pages, text } = await readPdf(await buildPreInspectionReportPdf(preInspectionFixture(false), { logo: null, signature: null }));
    assert.equal(pages.length, 1);
    const flat = text.replace(/\s+/g, " ");
    assert.ok(flat.includes("RELEVANT CONSENTS"));
    assert.ok(flat.includes("DA-25-01431"), "a CC names the development application it relies on");
    assert.ok(flat.includes("Construction Certificate Number"));
    assert.ok(flat.includes("cannot be a CC"));
    assert.ok(flat.includes("Mohamad El Ghoul – Inspector"));
  });
});
