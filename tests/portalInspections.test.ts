import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  portalInspectionType,
  portalInspectionResult,
  portalDocument,
  PORTAL_DOC_TYPES,
  initiateInspectionBody,
  performInspectionBody,
  completeInspectionBody,
} from "@/lib/portal/inspections";
import { INSPECTION_LIBRARY, ADDITIONAL_INSPECTION_LIBRARY } from "@/lib/constants";

// The NSW Planning Portal accepts only its own fixed vocabulary, and a
// payload it rejects is an inspection that silently never reaches the
// government record. So every builder here is held against the
// department's own specification — the schema file is generated from
// their published YAML, not written by hand.

type Schema = { type?: string; required?: string[]; properties?: Record<string, Schema>; items?: Schema };
const spec = JSON.parse(readFileSync(join(process.cwd(), "docs/planning-portal/pcc-certifier-schemas.json"), "utf8")) as {
  inspectionTypes: string[];
  inspectionResults: string[];
  requests: Record<string, Schema>;
};

// A payload conforms when every required field is present and nothing is
// sent that the specification does not know about.
function assertConforms(body: Record<string, unknown>, schema: Schema, where: string) {
  for (const field of schema.required || []) {
    assert.ok(field in body, `${where}: required field "${field}" is missing`);
  }
  for (const key of Object.keys(body)) {
    assert.ok(schema.properties && key in schema.properties, `${where}: sends "${key}", which the specification does not define`);
  }
  for (const [key, value] of Object.entries(body)) {
    const prop = schema.properties?.[key];
    if (prop?.type === "array" && prop.items?.properties && Array.isArray(value)) {
      value.forEach((item, i) => assertConforms(item as Record<string, unknown>, prop.items!, `${where}.${key}[${i}]`));
    }
  }
}

const doc = portalDocument("inspection-report.pdf", "https://example.supabase.co/signed/abc", PORTAL_DOC_TYPES.report);
const photo = portalDocument("site-photo.jpg", "https://example.supabase.co/signed/photo", PORTAL_DOC_TYPES.photos);

describe("speaking the Portal's language", () => {
  test("every CertFlow standard stage lands on a value the Portal accepts", () => {
    for (const { title } of [...INSPECTION_LIBRARY, ...ADDITIONAL_INSPECTION_LIBRARY]) {
      const mapped = portalInspectionType(title);
      assert.ok(spec.inspectionTypes.includes(mapped), `"${title}" mapped to "${mapped}", which the Portal does not accept`);
    }
  });

  test("the critical stages map to their own Portal values, not to Other", () => {
    assert.equal(portalInspectionType("Piers & Footings"), "Foundation / footings (prior to pouring of concrete)");
    assert.equal(portalInspectionType("Slab Steel"), "Foundation / footings (prior to pouring of concrete)");
    assert.equal(portalInspectionType("Frame"), "Framework (prior to fixing floor, wall and ceiling linings)");
    assert.equal(portalInspectionType("Waterproofing"), "Waterproofing of wet areas (prior to covering)");
    assert.equal(portalInspectionType("Stormwater"), "Stormwater drainage (prior to covering)");
    assert.equal(portalInspectionType("Final"), "Finalisation of works (all works completed)");
  });

  test("an inspection the Portal has no word for goes up as Other Inspection", () => {
    assert.equal(portalInspectionType("Pool Steel"), "Other Inspection");
    assert.equal(portalInspectionType("Fire Rated Wall"), "Other Inspection");
  });

  test("every CertFlow outcome maps to a result the Portal accepts, in both wordings", () => {
    for (const outcome of ["passed", "passed_subject_to", "failed"]) {
      for (const kind of ["building", "works"] as const) {
        const mapped = portalInspectionResult(outcome, kind);
        assert.ok(mapped && spec.inspectionResults.includes(mapped), `${outcome}/${kind} mapped to "${mapped}"`);
      }
    }
  });

  test("an outcome that is not a result — pending — refuses to map", () => {
    assert.equal(portalInspectionResult("pending"), null);
  });
});

describe("the three calls that report one inspection", () => {
  test("opening the inspection case conforms to the specification", () => {
    const body = initiateInspectionBody({ certflowTitle: "Frame", scheduledDate: "2026-08-26", registrationNumber: "BDC2961", updatedByEmail: "m@example.com" });
    assertConforms(body, spec.requests.InitiateInspection, "InitiateInspection");
    assert.deepEqual(body.inspectionType, ["Framework (prior to fixing floor, wall and ceiling linings)"]);
    // The live Portal rejects a call without the submitting user's email,
    // whatever the schema says about it being optional.
    assert.equal(body.updatedByEmail, "m@example.com");
  });

  // The live Portal demands a description on every inspection type, not
  // just "Other Inspection" as the written spec says.
  test("every inspection carries its CertFlow name in the description", () => {
    for (const title of ["Pool Steel", "Frame"]) {
      const body = initiateInspectionBody({ certflowTitle: title, registrationNumber: "BDC2961" });
      assertConforms(body, spec.requests.InitiateInspection, "InitiateInspection");
      assert.equal(body.description, title);
    }
  });

  test("recording the visit conforms, and carries the signed report as a link", () => {
    const body = performInspectionBody({
      childCaseID: "INS-1234",
      certflowTitle: "Waterproofing",
      inspectionDate: "2026-08-26",
      outcome: "passed_subject_to",
      inspectorName: "Mohamad El Ghoul",
      comments: "Minor sealing gap at the shower hob to be rectified.",
      documents: [photo],
      updatedByEmail: "m@example.com",
    });
    assertConforms(body, spec.requests.PerformInspection, "PerformInspection");
    assert.equal(body.inspectionResult, "Building has minor defects but is satisfactory");
    // The live service allows only "Inspection images" on the visit record.
    assert.equal((body.documents as { documentType: string }[])[0].documentType, "Inspection images");
  });

  test("closing the inspection out conforms to the specification", () => {
    const body = completeInspectionBody({
      childCaseID: "INS-1234",
      furtherInspectionRequired: false,
      declarations: "I certify the inspection was carried out as recorded.",
      inspectionResultDeclaration: "The works inspected are satisfactory.",
      documents: [doc],
      updatedByEmail: "m@example.com",
    });
    assertConforms(body, spec.requests.CompleteInspection, "CompleteInspection");
  });
});

// The Portal's answer to opening an inspection case carries the new case
// number as prose or loose JSON rather than a defined field, so the
// extraction has to cope with every shape the spec hints at.
describe("reading the inspection case number out of the Portal's answer", () => {
  // The reply the live service actually sends, captured from the first
  // accepted submission.
  test("from the live service's real phrasing", async () => {
    const { extractChildCaseId } = await import("@/lib/portal/client");
    assert.equal(extractChildCaseId('{"statusCode":200,"message":"INSP-189801 Case has been created successfully"}'), "INSP-189801");
    assert.equal(extractChildCaseId("INSP-189801 Case has been created successfully"), "INSP-189801");
  });

  test("from the spec's own phrasing", async () => {
    const { extractChildCaseId } = await import("@/lib/portal/client");
    assert.equal(extractChildCaseId("CaseID--INS-2026-4471 created Sucessfully."), "INS-2026-4471");
  });

  test("from JSON under the likely field names", async () => {
    const { extractChildCaseId } = await import("@/lib/portal/client");
    assert.equal(extractChildCaseId('{"childCaseID":"INS-9"}'), "INS-9");
    assert.equal(extractChildCaseId('{"caseId":"INS-10"}'), "INS-10");
    assert.equal(extractChildCaseId('{"description":"CaseID--INS-11 created Sucessfully."}'), "INS-11");
  });

  test("an answer with no case number in it says so rather than guessing", async () => {
    const { extractChildCaseId } = await import("@/lib/portal/client");
    assert.equal(extractChildCaseId("Accepted"), null);
    assert.equal(extractChildCaseId('{"status":"ok"}'), null);
  });
});

// The Portal refuses a visit record without at least one image, and not
// every inspection has photographs. The generated stand-in must be a
// real, readable image carrying the inspection's actual facts.
describe("the generated inspection record image", () => {
  test("is a real JPEG with sensible dimensions", async () => {
    const { buildInspectionSummaryImage } = await import("@/lib/portal/summaryImage");
    const sharp = (await import("sharp")).default;
    const bytes = await buildInspectionSummaryImage({
      firmName: "Quality Private Certifiers",
      address: "378 Scenic Drive San Remo",
      inspectionTitle: "Piers & Footings",
      date: "24 Aug 2026",
      outcomeText: "Satisfactory (minor issues) subject to documents/conditions being provided",
      inspectorName: "Mohamad El Ghoul",
    });
    const meta = await sharp(Buffer.from(bytes)).metadata();
    // JPEG on purpose: the Portal's validator refused a PNG outright.
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 800);
  });

  test("copes with characters that would break the drawing", async () => {
    const { buildInspectionSummaryImage } = await import("@/lib/portal/summaryImage");
    const sharp = (await import("sharp")).default;
    const bytes = await buildInspectionSummaryImage({
      firmName: "Smith & Sons <Certifiers>",
      address: 'Unit 1/5 "The Grove" O\'Brien St',
      inspectionTitle: "Frame & Truss",
      date: "24 Aug 2026",
      outcomeText: "Satisfactory — no issues identified",
      inspectorName: "D'Arcy O'Neill",
    });
    assert.equal((await sharp(Buffer.from(bytes)).metadata()).format, "jpeg");
  });
});

// The links handed to the Portal carry their authority in a sealed token
// rather than a query string, because the Portal's document validation
// refused a storage link. The seal has to hold.
describe("the document links handed to the Portal", () => {
  test("a token serves exactly the file it names, then expires", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-secret";
    const { portalFileToken, verifyPortalFileToken } = await import("@/lib/portal/files");
    const token = portalFileToken("firm/job/inspections/i1/report.pdf", 60);
    assert.equal(verifyPortalFileToken(token), "firm/job/inspections/i1/report.pdf");

    const expired = portalFileToken("firm/job/inspections/i1/report.pdf", -1);
    assert.equal(verifyPortalFileToken(expired), null);
  });

  test("a tampered token serves nothing", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-secret";
    const { portalFileToken, verifyPortalFileToken } = await import("@/lib/portal/files");
    const token = portalFileToken("firm/job/a.pdf", 60);
    const [payload] = token.split(".");
    const other = Buffer.from(JSON.stringify({ p: "firm/job/SOMETHING-ELSE.pdf", e: Math.floor(Date.now() / 1000) + 60 })).toString("base64url");
    assert.equal(verifyPortalFileToken(`${other}.${token.split(".")[1]}`), null, "someone else's path under my seal");
    assert.equal(verifyPortalFileToken(`${payload}.AAAA`), null, "a forged seal");
    assert.equal(verifyPortalFileToken("rubbish"), null);
  });

  test("the URL ends in the plain filename", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://certflow.example";
    const { portalFileUrl } = await import("@/lib/portal/files");
    const url = portalFileUrl("firm/job/x.jpg", "inspection-record.jpg");
    assert.ok(url.startsWith("https://certflow.example/api/portal-files/"));
    assert.ok(url.endsWith("/inspection-record.jpg"));
    assert.ok(!url.includes("?"), "no query string for the Portal's validator to refuse");
  });
});

// The inbound endpoint ePlanning's gateway downloads from, guarded by
// the Basic Auth credentials lodged at registration and a sealed DocID.
describe("the registered inbound document endpoint", () => {
  test("a DocID names exactly one file and survives tampering attempts", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-secret";
    const { eplanningDocId, verifyEplanningDocId } = await import("@/lib/portal/files");
    const id = eplanningDocId("firm/job/inspections/i1/report.pdf");
    assert.equal(verifyEplanningDocId(id), "firm/job/inspections/i1/report.pdf");
    assert.equal(verifyEplanningDocId(id.slice(0, -4) + "AAAA"), null);
    assert.equal(verifyEplanningDocId("rubbish"), null);
  });

  test("Basic Auth admits only the lodged credentials", async () => {
    process.env.EPLANNING_INBOUND_USERNAME = "user-uuid";
    process.env.EPLANNING_INBOUND_PASSWORD = "pass-uuid";
    const { eplanningAuthOk } = await import("@/lib/portal/files");
    const good = "Basic " + Buffer.from("user-uuid:pass-uuid").toString("base64");
    const bad = "Basic " + Buffer.from("user-uuid:wrong").toString("base64");
    assert.equal(eplanningAuthOk(good), true);
    assert.equal(eplanningAuthOk(bad), false);
    assert.equal(eplanningAuthOk(null), false);
    assert.equal(eplanningAuthOk("Bearer something"), false);
  });

  test("with no credentials configured, the door stays shut entirely", async () => {
    const { eplanningAuthOk } = await import("@/lib/portal/files");
    const u = process.env.EPLANNING_INBOUND_USERNAME;
    const p = process.env.EPLANNING_INBOUND_PASSWORD;
    delete process.env.EPLANNING_INBOUND_USERNAME;
    delete process.env.EPLANNING_INBOUND_PASSWORD;
    assert.equal(eplanningAuthOk("Basic " + Buffer.from(":").toString("base64")), false);
    assert.equal(eplanningAuthOk("Basic " + Buffer.from("a:b").toString("base64")), false);
    if (u) process.env.EPLANNING_INBOUND_USERNAME = u;
    if (p) process.env.EPLANNING_INBOUND_PASSWORD = p;
  });

  test("the announced documentURL sits under the registered inbound base", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://certflow.example";
    const { eplanningDocumentUrl } = await import("@/lib/portal/files");
    const url = eplanningDocumentUrl("firm/job/x.pdf");
    assert.ok(url.startsWith("https://certflow.example/api/eplanning/v1/office/Documents/"));
    assert.ok(!url.includes("?"));
  });
});
