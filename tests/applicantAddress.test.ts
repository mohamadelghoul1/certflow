import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { missingJobFields } from "@/lib/validation/job";
import { buildPreview } from "@/lib/import/jobRows";
import { parseTable } from "@/lib/import/parseTable";
import type { JobDetails } from "@/types/db";

// On most residential jobs the applicant lives at the site, so asking
// for their postal address a second time is asking the certifier to
// chase paperwork that says what the job already says. Ticking "same as
// the property address" has to actually satisfy the certificate, not
// just hide the boxes — otherwise the job stalls at issuing.

const base = {
  pathway: "CDC" as const,
  address: "21 Coquet Way, Green Valley NSW 2168",
  description: "New dwelling",
  certifierId: "c1",
  details: {
    certificateDetails: { lotSectionDp: "9 / DP253031" },
    council: { lga: "Liverpool" },
    contact: { nameOrCompany: "J Smith" },
    proposal: { classifications: ["1a"], estimatedCost: "450000" },
    bcaVersion: "NCC 2022",
    zoning: "R2",
    ownerSameAsApplicant: true,
  } as JobDetails,
};

describe("applicant address the same as the site", () => {
  test("without the box ticked, all four parts are still required", () => {
    const missing = missingJobFields(base);
    assert.deepEqual(missing, ["Applicant street number", "Applicant street", "Applicant suburb", "Applicant postcode"]);
  });

  test("ticking it clears them, because the property address is already required", () => {
    const missing = missingJobFields({ ...base, details: { ...base.details, applicantSameAsSite: true } });
    assert.deepEqual(missing, []);
  });

  // The box says "same as the property address" — if the property
  // address itself is blank there is nothing to be the same as, and the
  // job must still be refused.
  test("does not excuse a job with no property address", () => {
    const missing = missingJobFields({ ...base, address: "", details: { ...base.details, applicantSameAsSite: true } });
    assert.ok(missing.includes("Property address"));
  });
});

describe("importing jobs that carry no applicant address", () => {
  // BCS's export has street/suburb columns and no separate site column,
  // so the same columns are both the site and the applicant's address.
  test("marks the applicant address as the site when the site was built from those columns", () => {
    const table = parseTable("Street Number\tStreet\tSuburb\tState\tPostcode\tApplicant Name\n21\tCoquet Way\tGreen Valley\tNSW\t2168\tJ Smith")!;
    const { jobs } = buildPreview({ headers: table.headers, rows: table.rows });
    assert.equal(jobs[0].details.applicantSameAsSite, true);
    assert.equal(jobs[0].details.applicantAddress?.street, "Coquet Way");
    assert.equal(jobs[0].details.applicantAddress?.suburb, "Green Valley");
  });

  test("marks it when the export gives a site address and no applicant address at all", () => {
    const table = parseTable("Property Address\tApplicant Name\n21 Coquet Way, Green Valley NSW 2168\tJ Smith")!;
    const { jobs } = buildPreview({ headers: table.headers, rows: table.rows });
    assert.equal(jobs[0].details.applicantSameAsSite, true);
    assert.equal(jobs[0].details.applicantAddress?.streetNumber, "21");
    assert.equal(jobs[0].details.applicantAddress?.postcode, "2168");
  });

  // An export that does give a separate postal address must be believed
  // — the applicant is a builder with an office, and printing the site
  // on their correspondence would be wrong.
  test("leaves a real applicant postal address alone", () => {
    const table = parseTable(
      "Property Address\tApplicant Address\tApplicant Name\n21 Coquet Way, Green Valley NSW 2168\t5 Rickard Road, Bankstown NSW 2200\tJ Smith",
    )!;
    const { jobs } = buildPreview({ headers: table.headers, rows: table.rows });
    assert.equal(jobs[0].details.applicantSameAsSite, false);
    assert.equal(jobs[0].details.applicantAddress?.suburb, "Bankstown");
  });
});
