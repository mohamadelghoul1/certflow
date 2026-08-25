import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeJobDetails } from "@/lib/jobDetails";
import type { JobDetails } from "@/types/db";

// What the Details form produces: the fields it actually has boxes for.
const fromForm = {
  zoning: "R3",
  certificateDetails: { lotSectionDp: "9 / DP253031", planningPortalRef: "PAN-12345", relevantInstrument: "Housing SEPP 2021" },
} as JobDetails;

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

    const merged = mergeJobDetails(existing, fromForm);
    assert.deepEqual(merged.preInspection, { applicationDate: "2025-12-09", inspectionDate: "2026-01-20" });
    assert.deepEqual(merged.siteSensitivities, ["Bushfire prone land", "Flood planning area"]);
  });

  test("still takes what the form does manage", () => {
    const merged = mergeJobDetails({ zoning: "R2" } as JobDetails, fromForm);
    assert.equal(merged.zoning, "R3");
    assert.equal(merged.certificateDetails?.lotSectionDp, "9 / DP253031");
    assert.equal(merged.certificateDetails?.planningPortalRef, "PAN-12345");
  });

  // certificateDetails is rebuilt by the form, so the two fields inside it
  // that are set elsewhere have to survive that rebuild.
  test("keeps the determination date, which is stamped when the certificate is issued", () => {
    const existing = { certificateDetails: { determinationDate: "2026-08-25", consentReferences: "DA-25-01431" } } as JobDetails;
    const merged = mergeJobDetails(existing, fromForm);
    assert.equal(merged.certificateDetails?.determinationDate, "2026-08-25");
    assert.equal(merged.certificateDetails?.consentReferences, "DA-25-01431");
    assert.equal(merged.certificateDetails?.lotSectionDp, "9 / DP253031", "and still takes the form's own fields");
  });

  test("a job with nothing recorded yet simply takes the form", () => {
    const merged = mergeJobDetails(null, fromForm);
    assert.equal(merged.zoning, "R3");
    assert.equal(merged.certificateDetails?.determinationDate, "");
  });
});
