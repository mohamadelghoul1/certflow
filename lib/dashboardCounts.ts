import { unresolvedCount, type ChecklistItemLike } from "@/lib/business";

// What the dashboard's tiles and stage breakdown report about one job.
//
// Extracted from the dashboard page so the rules can be tested directly:
// this is where a freshly issued CDC was being counted as an OC assessment
// in progress, because "the OC checklist has unapproved items" is true of
// every job from the day it is created.

export type CountableChecklist = { kind: string; checklist_items?: ChecklistItemLike[] | null };
export type CountableJob = {
  status?: string | null;
  pathway?: string | null;
  pathway_generated?: boolean | null;
  checklists?: CountableChecklist[] | null;
  // Only the outcomes: an inspection carried out is what says the works
  // have started.
  inspections?: { outcome?: string | null }[] | null;
};

export type JobStage = "complete" | "underConstruction" | "awaitingCommencement" | "readyToIssue" | "assessment";

export type JobCounts = {
  stage: JobStage;
  // Assessing an application for a certificate we have not issued yet.
  pathwayAssessment: boolean;
  // Every document approved, waiting on the certificate to be issued.
  approvalToIssue: boolean;
  // Someone has started the OC checklist and it isn't finished.
  ocAssessment: boolean;
  // Documents submitted by the client with nothing outstanding on them.
  documentsForReview: number;
};

function itemsFor(job: CountableJob, kind: string): ChecklistItemLike[] {
  return (job.checklists || []).find((c) => c.kind === kind)?.checklist_items || [];
}

function allApproved(items: ChecklistItemLike[]) {
  return items.length > 0 && items.every((i) => i.status === "approved");
}

export function countJob(job: CountableJob): JobCounts {
  const documentsForReview = (job.checklists || []).reduce(
    (total, cl) => total + (cl.checklist_items || []).filter((i) => i.status === "submitted" && unresolvedCount(i) === 0).length,
    0
  );

  if (job.status === "complete") {
    return { stage: "complete", pathwayAssessment: false, approvalToIssue: false, ocAssessment: false, documentsForReview };
  }

  const pathwayItems = itemsFor(job, "pathway");
  const pathwayDone = allApproved(pathwayItems);
  // A PC/OC job — every imported job is one — carries an approval
  // someone else issued. There is nothing for this firm to issue, so it
  // can never be "ready to issue": it starts life awaiting commencement.
  const priorApproval = job.pathway === "PC_OC";
  const issued = !!job.pathway_generated || priorApproval;
  // Works have started once an inspection has actually been carried
  // out, whatever the NOC checklist says — a job imported mid-build
  // with its piers already inspected is under construction.
  const commenced = (job.inspections || []).some((i) => !!i.outcome && i.outcome !== "pending");

  // Issuing the certificate does not put a job on site. The applicant
  // still has to appoint a principal certifier and lodge the notice of
  // commencement, which can take weeks — so a job sits in "awaiting
  // commencement" until its NOC checklist is settled, and only then counts
  // as under construction.
  //
  // A NOC checklist with no items at all means the firm's document library
  // has no NOC documents in it. There is nothing to determine in that
  // case, so it must not hold a job back for ever.
  const nocItems = itemsFor(job, "noc");
  const nocSettled = nocItems.length === 0 || nocItems.every((i) => i.status === "approved");

  const stage: JobStage = issued
    ? nocSettled || commenced
      ? "underConstruction"
      : "awaitingCommencement"
    : pathwayDone
      ? "readyToIssue"
      : "assessment";

  // An OC assessment is under way once someone has actually engaged with
  // the OC checklist — a document submitted or approved — and it isn't
  // finished. Open items alone don't count: every job's OC checklist
  // starts full of them.
  const ocItems = itemsFor(job, "oc");
  const ocStarted = ocItems.some((i) => i.status !== "requested");
  const ocAssessment = issued && ocStarted && !allApproved(ocItems);

  return {
    stage,
    pathwayAssessment: !issued && !pathwayDone,
    approvalToIssue: !issued && pathwayDone,
    ocAssessment,
    documentsForReview,
  };
}
