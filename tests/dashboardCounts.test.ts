import { test } from "node:test";
import assert from "node:assert/strict";
import { countJob, type CountableJob } from "@/lib/dashboardCounts";

const requested = (n: number) => Array.from({ length: n }, () => ({ status: "requested" as const }));
const approved = (n: number) => Array.from({ length: n }, () => ({ status: "approved" as const }));

function job(parts: Partial<CountableJob> & { pathway?: unknown[]; noc?: unknown[]; oc?: unknown[] } = {}): CountableJob {
  return {
    status: parts.status ?? "active",
    pathway_generated: parts.pathway_generated ?? false,
    checklists: [
      { kind: "pathway", checklist_items: (parts.pathway as never) ?? approved(0) },
      { kind: "noc", checklist_items: (parts.noc as never) ?? requested(4) },
      { kind: "oc", checklist_items: (parts.oc as never) ?? requested(8) },
    ],
  };
}

test("a job still collecting documents is an assessment in progress", () => {
  const c = countJob(job({ pathway: [...approved(2), ...requested(4)] }));
  assert.equal(c.stage, "assessment");
  assert.equal(c.pathwayAssessment, true);
  assert.equal(c.approvalToIssue, false);
});

test("a full checklist with nothing issued is an approval to issue", () => {
  const c = countJob(job({ pathway: approved(6) }));
  assert.equal(c.stage, "readyToIssue");
  assert.equal(c.pathwayAssessment, false);
  assert.equal(c.approvalToIssue, true);
});

// The defect reported from the live dashboard: one CDC issued, nothing
// else touched, and the tile read "1 assessment in progress".
test("a freshly issued CDC is not an assessment of any kind", () => {
  const c = countJob(job({ pathway_generated: true, pathway: approved(6), oc: requested(8) }));
  assert.equal(c.pathwayAssessment, false, "the certificate is issued, so no CDC assessment");
  assert.equal(c.ocAssessment, false, "an untouched OC checklist is not an assessment under way");
  assert.equal(c.approvalToIssue, false);
  assert.equal(c.stage, "awaitingCommencement");
});

test("the OC becomes an assessment once a document is actually submitted", () => {
  const started = countJob(job({ pathway_generated: true, pathway: approved(6), oc: [{ status: "submitted" }, ...requested(7)] }));
  assert.equal(started.ocAssessment, true);
});

test("a finished OC checklist is no longer an assessment", () => {
  const done = countJob(job({ pathway_generated: true, pathway: approved(6), oc: approved(8) }));
  assert.equal(done.ocAssessment, false);
});

test("issuing a certificate does not put the job on site", () => {
  const waiting = countJob(job({ pathway_generated: true, pathway: approved(6), noc: requested(4) }));
  const onSite = countJob(job({ pathway_generated: true, pathway: approved(6), noc: approved(4) }));
  assert.equal(waiting.stage, "awaitingCommencement");
  assert.equal(onSite.stage, "underConstruction");
});

// A firm whose document library has no NOC items must not have every job
// stuck in "awaiting commencement" for ever.
test("an empty NOC checklist does not hold a job back", () => {
  const c = countJob(job({ pathway_generated: true, pathway: approved(6), noc: [] }));
  assert.equal(c.stage, "underConstruction");
});

test("a completed job counts only as complete", () => {
  const c = countJob(job({ status: "complete", pathway_generated: true, pathway: approved(6), oc: approved(8) }));
  assert.equal(c.stage, "complete");
  assert.equal(c.pathwayAssessment, false);
  assert.equal(c.ocAssessment, false);
});

test("documents for review counts submitted items with nothing outstanding", () => {
  const c = countJob({
    status: "active",
    pathway_generated: false,
    checklists: [
      {
        kind: "pathway",
        checklist_items: [
          { status: "submitted", amendments: [] },
          { status: "submitted", amendments: [{ resolved: false }] },
          { status: "submitted", amendments: [{ resolved: true }] },
          { status: "approved" },
        ],
      },
    ],
  });
  assert.equal(c.documentsForReview, 2, "an item with an unresolved amendment is with the client, not with us");
});

test("a job with no checklists at all is counted without throwing", () => {
  const c = countJob({ status: "active", pathway_generated: false });
  assert.equal(c.stage, "assessment");
  assert.equal(c.documentsForReview, 0);
});
