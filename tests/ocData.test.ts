import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getOcCertificateData } from "@/lib/certificates/ocData";
import { fakeSupabase } from "./helpers/fakeSupabase";

// What the Occupation Certificate says, as getOcCertificateData works it
// out from a real job — the derivations the renderers only place.
// Pinned here because these are the parts transcribed from the
// practice's own issued OCs: the numbering that follows the certificate
// it completes, the five-year condition a partial carries, and the
// consents block that differs between a CDC and a CC job.

function jobRow(pathway: "CDC" | "CC" | "PC_OC", details: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    firm_id: "firm-1",
    address: "3 The Comenarra Parkway, Thornleigh NSW 2120",
    description: "Construction of a detached secondary dwelling",
    pathway,
    pathway_version: 1,
    pathway_generated: pathway !== "PC_OC",
    details: {
      projectNumber: pathway === "CC" ? "CC-26057" : "26057",
      contact: { givenNames: "Zahra", surname: "Lotfibakalani", phone: "0451 462 320" },
      council: { lga: "The Council of the Shire of Hornsby" },
      certificateDetails: {
        lotSectionDp: "18/-/DP9872",
        relevantInstrument: "SEPP (Exempt and Complying Development Codes) 2008",
        relevantPartOfCode: "Part 3C Greenfield Housing Code",
        ...(pathway === "CC" ? { developmentConsentNumber: "DA-25-00105", developmentConsentDate: "2025-02-18" } : {}),
      },
      proposal: { classifications: ["1a", "10a"] },
      ...details,
    },
  };
}

function ocRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "oc-1",
    job_id: "11111111-2222-3333-4444-555555555555",
    type: "whole",
    description: null,
    exclusions: null,
    cert_ref: null,
    generated_date: "2026-09-01",
    issued_by: "cert-1",
    signed_at: null,
    approval_uploaded: false,
    approval_file_path: null,
    ...overrides,
  };
}

function clientFor(job: Record<string, unknown>, record: Record<string, unknown>) {
  return fakeSupabase((call) => {
    switch (call.table) {
      case "jobs":
        return { data: job };
      case "firms":
        return { data: { id: "firm-1", name: "Quality Private Certifiers Pty Ltd", abn: "41 630 945 416", logo_url: null } };
      case "oc_records":
        return { data: [record] };
      case "checklists":
        return { data: [] };
      case "pathway_certificate_versions":
        return { data: { cert_ref: null } };
      case "certifiers":
        return { data: { name: "Mohamad El Ghoul", registration_no: "BDC2961", registration_body: "Building Commission NSW", signature_url: null } };
      default:
        return { data: null };
    }
  }).client;
}

async function dataFor(job: Record<string, unknown>, record: Record<string, unknown> = ocRecord()) {
  const data = await getOcCertificateData(String(job.id), String(record.id), "firm-1", clientFor(job, record));
  assert.ok(data, "the OC data should resolve");
  return data;
}

describe("what the Occupation Certificate derives from a CDC job", () => {
  test("its number is the CDC it completes, and the title says so", async () => {
    const data = await dataFor(jobRow("CDC"));
    assert.equal(data.ref, "CDC-26057/01", "the OC is numbered after the certificate it completes");
    assert.equal(data.projRef, "CDC-26057");
    assert.equal(data.certTitle, "OCCUPATION CERTIFICATE - WHOLE - CDC-26057/01 (RESIDENTIAL)");
    assert.equal(data.certSubtitle, "Issued under Part 6 of the Environmental Planning and Assessment Act 1979");
  });

  test("the letters name what the CDC was decided under", async () => {
    const data = await dataFor(jobRow("CDC"));
    assert.deepEqual(data.letterFacts, [
      { label: "Decision Made Under:", value: "SEPP (Exempt and Complying Development Codes) 2008 - Part 3C Greenfield Housing Code" },
    ]);
  });

  test("the declaration names a Complying Development Certificate", async () => {
    const data = await dataFor(jobRow("CDC"));
    assert.ok(data.determination.bullets.some((b) => b === "A Complying Development Certificate has been issued with respect to the plans and specifications for the building;"));
    assert.equal(data.consentFull, "Complying Development Certificate");
  });
});

describe("what it derives from a CC job", () => {
  test("the letters name the development application instead", async () => {
    const data = await dataFor(jobRow("CC"));
    assert.deepEqual(data.letterFacts, [{ label: "Development Application No.:", value: "DA-25-00105" }]);
  });

  test("the declaration names a Construction Certificate", async () => {
    const data = await dataFor(jobRow("CC"));
    assert.equal(data.ref, "CC-26057/01");
    assert.ok(data.determination.bullets.some((b) => b === "A Construction Certificate has been issued with respect to the plans and specifications for the building;"));
    assert.equal(data.consentFull, "Construction Certificate");
  });
});

describe("whole against partial", () => {
  test("a whole OC carries no conditions, and thanks the client", async () => {
    const data = await dataFor(jobRow("CDC"));
    assert.equal(data.partialConditions, null);
    assert.ok(data.applicantBody.some((p) => p.includes("thank you for using our services")));
    assert.ok(!data.determination.bullets.some((b) => b.includes("health and safety")));
  });

  test("a partial OC carries clause 53 and warns the client of the five-year clock", async () => {
    const data = await dataFor(jobRow("CDC"), ocRecord({ type: "partial" }));
    assert.ok(data.partialConditions?.clause.includes("s 6.33(1)"));
    assert.ok(data.partialConditions?.text.includes("within 5 years"));
    assert.ok(data.applicantBody.some((p) => p.includes("within 5 years") && p.includes("A fee will apply")));
    assert.ok(data.determination.bullets.some((b) => b.includes("health and safety of the occupants")));
    assert.equal(data.certTitle, "OCCUPATION CERTIFICATE - PARTIAL - CDC-26057/01 (RESIDENTIAL)");
  });
});

describe("the number on the certificate", () => {
  // A PC/OC job's approval belongs to another certifier — our OC never
  // borrows their number.
  test("a PC/OC job numbers its OCs in a series of this firm's own", async () => {
    const job = jobRow("PC_OC", { priorApproval: { type: "CDC", number: "CDC-9999/01" } });
    const data = await dataFor(job);
    assert.equal(data.ref, "OC-26057/01", "another certifier's number must never head our certificate");
  });

  test("a number stamped on the record at issue wins over everything", async () => {
    const data = await dataFor(jobRow("CDC"), ocRecord({ cert_ref: "CDC-26057/02" }));
    assert.equal(data.ref, "CDC-26057/02");
  });

  test("a class 2 building is not called residential in the title", async () => {
    const data = await dataFor(jobRow("CDC", { proposal: { classifications: ["2"] } }));
    assert.equal(data.certTitle, "OCCUPATION CERTIFICATE - WHOLE - CDC-26057/01");
  });
});
