import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// What a client can see about an inspection, held to by reading the
// portal page itself.
//
// Two rules, both easy to undo by accident while adding something else:
// the signed report is the certifier's record and is never offered for
// download here, and nothing on this page says whether the NSW Planning
// Portal has been told — that is between the certifier and the
// regulator, and a client reading "not yet reported" has no way to act
// on it and every reason to worry.
const portalJobPage = readFileSync(join(process.cwd(), "app/portal/(app)/jobs/[id]/page.tsx"), "utf8");

describe("what the client's portal shows about an inspection", () => {
  test("offers no way to view or download the report", () => {
    assert.ok(!portalJobPage.includes("View inspection report"), "the report link is gone");
    assert.ok(!portalJobPage.includes("report_pdf_path"), "and nothing builds a link to the signed report");
  });

  test("says nothing about the NSW Planning Portal having been told", () => {
    assert.ok(!portalJobPage.includes("portal_reported"), "reporting status is the certifier's business, not the client's");
  });

  // The result is the one thing the client is here for, and it only
  // exists once the visit has happened — a half-filled inspection is the
  // certifier's working note.
  test("shows what was found only once the inspection has been carried out", () => {
    assert.ok(portalJobPage.includes('const carriedOut = stage === "carried_out"'));
    assert.ok(portalJobPage.includes("{carriedOut && insp.defects.length > 0 && ("), "issues and items owed wait for the outcome");
  });
});
