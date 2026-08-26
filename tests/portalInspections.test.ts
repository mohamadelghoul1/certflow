import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  portalInspectionType,
  portalInspectionResult,
  portalDocument,
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

const doc = portalDocument("inspection-report.pdf", "https://example.supabase.co/signed/abc");

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
    const body = initiateInspectionBody({ certflowTitle: "Frame", scheduledDate: "2026-08-26", registrationNumber: "BDC2961" });
    assertConforms(body, spec.requests.InitiateInspection, "InitiateInspection");
    assert.deepEqual(body.inspectionType, ["Framework (prior to fixing floor, wall and ceiling linings)"]);
  });

  test("an Other inspection carries its CertFlow name in the description", () => {
    const body = initiateInspectionBody({ certflowTitle: "Pool Steel", registrationNumber: "BDC2961" });
    assertConforms(body, spec.requests.InitiateInspection, "InitiateInspection");
    assert.equal(body.description, "Pool Steel");
  });

  test("recording the visit conforms, and carries the signed report as a link", () => {
    const body = performInspectionBody({
      childCaseID: "INS-1234",
      certflowTitle: "Waterproofing",
      inspectionDate: "2026-08-26",
      outcome: "passed_subject_to",
      inspectorName: "Mohamad El Ghoul",
      comments: "Minor sealing gap at the shower hob to be rectified.",
      documents: [doc],
    });
    assertConforms(body, spec.requests.PerformInspection, "PerformInspection");
    assert.equal(body.inspectionResult, "Building has minor defects but is satisfactory");
    assert.equal((body.documents as { documentURL: string }[])[0].documentURL, "https://example.supabase.co/signed/abc");
  });

  test("closing the inspection out conforms to the specification", () => {
    const body = completeInspectionBody({
      childCaseID: "INS-1234",
      furtherInspectionRequired: false,
      declarations: "I certify the inspection was carried out as recorded.",
      inspectionResultDeclaration: "The works inspected are satisfactory.",
      documents: [doc],
    });
    assertConforms(body, spec.requests.CompleteInspection, "CompleteInspection");
  });
});

// The Portal's answer to opening an inspection case carries the new case
// number as prose or loose JSON rather than a defined field, so the
// extraction has to cope with every shape the spec hints at.
describe("reading the inspection case number out of the Portal's answer", () => {
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
