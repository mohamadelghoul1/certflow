import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPreInspectionReportDocx } from "@/lib/docx/preInspectionReport";
import { preInspectionRows, type PreInspectionData } from "@/lib/certificates/preInspectionData";
import { readDocx } from "./helpers/readDocuments";
import type { Firm } from "@/types/db";

const firm = { name: "Quality Private Certifiers", abn: "41 630 945 416", postal_address: "PO BOX 195", office_address: "Yagoona NSW 2199", phone: "0404 940 898", email: "info@example.com", website: "www.example.com" } as unknown as Firm;

function data(isCdc: boolean): PreInspectionData {
  const ref = isCdc ? "CDC-26053/01" : "CC-25477/01";
  const regulationTitle = isCdc ? "139 EP and A Regulation 2021" : "S16 EP&A (Development Certification and Fire Safety) Regulation 2021";
  return {
    job: {} as never,
    firm,
    inspector: null,
    logoUrl: null,
    signatureUrl: null,
    isCdc,
    regulationTitle,
    title: `INSPECTION REPORT – ${ref} – 1. ${regulationTitle}`,
    ref,
    projRef: isCdc ? "CDC-26053" : "CC-25477",
    address: "48 Alice Street, Rooty Hill NSW 2766",
    applicantName: "MD Shahidul Karim",
    applicantAddress: "48 Alice Street, Rooty Hill NSW 2766",
    applicantPhone: "0433650299",
    lga: "Blacktown City Council",
    developmentConsentNumber: isCdc ? "" : "DA-25-01431",
    certificateLabel: isCdc ? "CDC Number" : "Construction Certificate Number",
    applicationDate: "09 Dec 2025",
    inspectionDate: "20 Jan 2026",
    lotSectionDp: "9 / DP253031",
    zoning: "R2",
    scopeOfWorks: "Alterations and additions to a dwelling",
    inspectorName: "Mohamad El Ghoul",
    registrationNo: "BDC2961",
    rows: preInspectionRows(isCdc),
  };
}

async function textOf(isCdc: boolean) {
  return (await readDocx(await buildPreInspectionReportDocx(data(isCdc), { logo: null, signature: null }))).text;
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
