import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detailsPatchFromForm, deepMergeDetails } from "@/lib/jobDetails";
import type { JobDetails } from "@/types/db";

// What the Details form produces: the fields it actually has boxes for.
// The form always fills certificateDetails in full, including the two
// entries inside it that it has no business setting.
const fromForm = {
  zoning: "R3",
  certificateDetails: {
    lotSectionDp: "9 / DP253031",
    planningPortalRef: "PAN-12345",
    relevantInstrument: "Housing SEPP 2021",
    determinationDate: "",
    consentReferences: "",
  },
} as JobDetails;

// Saving the form is a patch applied to what is already recorded, so
// what the merge does with that patch is what the certifier sees.
function save(existing: JobDetails | null, form: JobDetails): JobDetails {
  return deepMergeDetails(existing || {}, detailsPatchFromForm(form)) as JobDetails;
}

describe("saving the Details tab", () => {
  // Both of these are set from other screens entirely — the pre-inspection
  // dates from the certificates tab, the sensitivities from the job
  // header — and pressing Save details used to wipe them.
  test("keeps details the form has no boxes for", () => {
    const existing = {
      zoning: "R2",
      preInspection: { applicationDate: "2025-12-09", inspectionDate: "2026-01-20" },
      siteSensitivities: ["Bushfire prone land", "Flood planning area"],
    } as JobDetails;

    const saved = save(existing, fromForm);
    assert.deepEqual(saved.preInspection, { applicationDate: "2025-12-09", inspectionDate: "2026-01-20" });
    assert.deepEqual(saved.siteSensitivities, ["Bushfire prone land", "Flood planning area"]);
  });

  test("still takes what the form does manage", () => {
    const saved = save({ zoning: "R2" } as JobDetails, fromForm);
    assert.equal(saved.zoning, "R3");
    assert.equal(saved.certificateDetails?.lotSectionDp, "9 / DP253031");
    assert.equal(saved.certificateDetails?.planningPortalRef, "PAN-12345");
  });

  // certificateDetails is rebuilt by the form, so the two fields inside it
  // that are set elsewhere have to survive that rebuild.
  test("keeps the determination date, which is stamped when the certificate is issued", () => {
    const existing = { certificateDetails: { determinationDate: "2026-08-25", consentReferences: "DA-25-01431" } } as JobDetails;
    const saved = save(existing, fromForm);
    assert.equal(saved.certificateDetails?.determinationDate, "2026-08-25");
    assert.equal(saved.certificateDetails?.consentReferences, "DA-25-01431");
    assert.equal(saved.certificateDetails?.lotSectionDp, "9 / DP253031", "and still takes the form's own fields");
  });

  test("a job with nothing recorded yet simply takes the form", () => {
    const saved = save(null, fromForm);
    assert.equal(saved.zoning, "R3");
    assert.equal(saved.certificateDetails?.lotSectionDp, "9 / DP253031");
  });

  // A job switched away from PC/OC must lose the prior approval, or
  // another certifier's approval keeps printing on its documents.
  test("drops the prior approval when the job is no longer PC/OC", () => {
    const existing = { priorApproval: { type: "CDC", number: "CDC-1", date: "2026-01-01", issuedBy: "Someone Else" } } as JobDetails;
    const saved = save(existing, fromForm);
    assert.equal(saved.priorApproval, undefined);
  });

  test("keeps the prior approval on a job that still has one", () => {
    const pcOcForm = { ...fromForm, priorApproval: { type: "CC" as const, number: "CC-9", date: "2026-02-02", issuedBy: "Another Firm" } } as JobDetails;
    const saved = save({} as JobDetails, pcOcForm);
    assert.equal(saved.priorApproval?.number, "CC-9");
  });
});

// The same rules the database applies in migration 0029. These two
// implementations have to agree, because which one runs depends only on
// whether that migration has been applied yet.
describe("merging a patch into a job's details", () => {
  test("a patch inside an object leaves the rest of that object alone", () => {
    const merged = deepMergeDetails({ certificateDetails: { lot: "7", ref: "PAN-1" } }, { certificateDetails: { ref: "PAN-2" } });
    assert.deepEqual(merged, { certificateDetails: { lot: "7", ref: "PAN-2" } });
  });

  // Unticking a sensitivity has to be possible, so a list is replaced
  // rather than added to.
  test("a list is replaced whole, never appended to", () => {
    const merged = deepMergeDetails({ siteSensitivities: ["bushfire", "flood"] }, { siteSensitivities: ["flood"] });
    assert.deepEqual(merged, { siteSensitivities: ["flood"] });
  });

  test("null removes the key", () => {
    const merged = deepMergeDetails({ priorApproval: { type: "CDC" }, keep: "yes" }, { priorApproval: null });
    assert.deepEqual(merged, { keep: "yes" });
  });

  test("an empty patch changes nothing", () => {
    const merged = deepMergeDetails({ a: { b: 1 } }, {});
    assert.deepEqual(merged, { a: { b: 1 } });
  });

  test("starting from nothing recorded at all", () => {
    assert.deepEqual(deepMergeDetails(null, { a: 1 }), { a: 1 });
    assert.deepEqual(deepMergeDetails(undefined, { a: 1 }), { a: 1 });
  });

  // The point of the whole exercise: three screens each writing their own
  // field, and all three surviving.
  test("separate writers do not overwrite each other", () => {
    let details: unknown = { projectNumber: "J-1" };
    details = deepMergeDetails(details, { siteSensitivities: ["bushfire"] });
    details = deepMergeDetails(details, { certificateDetails: { planningPortalRef: "PAN-9" } });
    details = deepMergeDetails(details, { certificateDetails: { determinationDate: "2026-08-25" } });

    assert.deepEqual(details, {
      projectNumber: "J-1",
      siteSensitivities: ["bushfire"],
      certificateDetails: { planningPortalRef: "PAN-9", determinationDate: "2026-08-25" },
    });
  });
});

// The builder block: recorded in full, and the old one-line field kept
// in step so the register and older screens keep reading true.
describe("the contractor on the details patch", () => {
  test("a saved contractor survives the merge with every part intact", () => {
    const saved = save(null, {
      contractor: { company: "Best Builds Pty Ltd", name: "Sam Builder", phone: "0400 000 000", email: "sam@bestbuilds.com.au", licenceNo: "12345C" },
      principalContractor: "Best Builds Pty Ltd",
    } as JobDetails);
    assert.equal(saved.contractor?.licenceNo, "12345C");
    assert.equal(saved.principalContractor, "Best Builds Pty Ltd");
  });

  test("an old job's one-line builder is not erased by a details save that doesn't mention it", () => {
    const existing = { principalContractor: "Old Line Builder" } as JobDetails;
    const saved = save(existing, fromForm);
    assert.equal(saved.principalContractor, "Old Line Builder");
  });
});

// A PC/OC job shows no construction detail, so saving its Details form
// must leave the values it already holds — an imported job's cost of
// works among them — exactly as recorded.
describe("a PC/OC details save and the hidden construction fields", () => {
  test("keeps the imported cost and site area through a save that doesn't show them", () => {
    const existing = { proposal: { classifications: ["1a"], estimatedCost: "450000" }, siteArea: "612" } as JobDetails;
    // What extractJobDetails now produces for PC_OC: classifications only.
    const saved = save(existing, { proposal: { classifications: ["1a", "10a"] } } as JobDetails);
    assert.equal(saved.proposal?.estimatedCost, "450000");
    assert.equal(saved.siteArea, "612");
    assert.deepEqual(saved.proposal?.classifications, ["1a", "10a"]);
  });
});
