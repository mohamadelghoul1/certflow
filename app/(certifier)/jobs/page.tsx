import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JobsList } from "@/components/certifier/JobsList";
import { stageComplete, checklistProgress, unresolvedCount, inspectionsComplete, inspectionProgress, issuesCertificate, pathwayLabel } from "@/lib/business";
import type { Job } from "@/types/db";

type ChecklistItemRow = { status: "requested" | "submitted" | "approved"; amendments: { resolved: boolean }[] };
type ChecklistRow = { kind: string; checklist_items: ChecklistItemRow[] };
type JobQueryRow = Job & { checklists: ChecklistRow[]; inspections: { outcome: string }[]; oc_records: { id: string }[] };

export default async function JobsListPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: rawJobs }, { data: certifiers }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, address, description, pathway, status, assigned_certifier_id, details, pathway_generated, checklists(kind, checklist_items(status, amendments(resolved))), inspections(outcome), oc_records(id)"
      )
      .eq("firm_id", profile.firm_id)
      .order("created_at", { ascending: false }),
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id).order("name"),
  ]);

  const jobs = ((rawJobs || []) as unknown as JobQueryRow[]).map((j) => {
    const pathwayItems = j.checklists.find((c) => c.kind === "pathway")?.checklist_items || [];
    const nocItems = j.checklists.find((c) => c.kind === "noc")?.checklist_items || [];
    const ocItems = j.checklists.find((c) => c.kind === "oc")?.checklist_items || [];
    const allItems = [...pathwayItems, ...nocItems, ...ocItems];
    const needsAttention = allItems.some((i) => unresolvedCount(i) > 0);
    const outcomes = j.inspections.map((i) => i.outcome);

    // A complete checklist is not a finished stage: the certificate still
    // has to be issued off the back of it. Green means issued; a stage
    // with every document approved and nothing issued yet reads as "to
    // issue", which is the certifier's cue to act. A PC/OC job issues no
    // certificate of its own, so there its complete checklist is the end
    // of that stage.
    const pathwayChecklistDone = stageComplete(pathwayItems);
    const pathwayIssued = issuesCertificate(j.pathway) ? !!j.pathway_generated : pathwayChecklistDone;
    const ocChecklistDone = stageComplete(ocItems);
    const ocIssued = (j.oc_records || []).length > 0;

    return {
      id: j.id,
      address: j.address,
      description: j.description || "",
      projectNumber: j.details?.projectNumber || "",
      status: j.status,
      needsAttention,
      certifierId: j.assigned_certifier_id,
      pathwayLabel: pathwayLabel(j.pathway),
      pathwayDone: pathwayChecklistDone && pathwayIssued,
      pathwayToIssue: pathwayChecklistDone && !pathwayIssued,
      pathwayProgress: checklistProgress(pathwayItems),
      nocDone: stageComplete(nocItems),
      nocProgress: checklistProgress(nocItems),
      inspDone: inspectionsComplete(outcomes),
      inspProgress: inspectionProgress(outcomes),
      ocDone: ocChecklistDone && ocIssued,
      ocToIssue: ocChecklistDone && !ocIssued,
      ocProgress: checklistProgress(ocItems),
    };
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-primary mb-6">Projects</h1>
      <JobsList jobs={jobs} certifiers={certifiers || []} />
    </div>
  );
}
