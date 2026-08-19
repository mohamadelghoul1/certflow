import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JobsList } from "@/components/certifier/JobsList";
import { stageComplete, checklistProgress, unresolvedCount, inspectionsComplete, inspectionProgress } from "@/lib/business";
import type { Job } from "@/types/db";

type ChecklistItemRow = { status: "requested" | "submitted" | "approved"; amendments: { resolved: boolean }[] };
type ChecklistRow = { kind: string; checklist_items: ChecklistItemRow[] };
type JobQueryRow = Job & { checklists: ChecklistRow[]; inspections: { outcome: string }[] };

export default async function JobsListPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const [{ data: rawJobs }, { data: certifiers }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, address, description, pathway, status, assigned_certifier_id, details, checklists(kind, checklist_items(status, amendments(resolved))), inspections(outcome)")
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

    return {
      id: j.id,
      address: j.address,
      description: j.description || "",
      projectNumber: j.details?.projectNumber || "",
      status: j.status,
      needsAttention,
      certifierId: j.assigned_certifier_id,
      pathwayLabel: j.pathway,
      pathwayDone: stageComplete(pathwayItems),
      pathwayProgress: checklistProgress(pathwayItems),
      nocDone: stageComplete(nocItems),
      nocProgress: checklistProgress(nocItems),
      inspDone: inspectionsComplete(outcomes),
      inspProgress: inspectionProgress(outcomes),
      ocDone: stageComplete(ocItems),
      ocProgress: checklistProgress(ocItems),
    };
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-teal-900 mb-6">Jobs</h1>
      <JobsList jobs={jobs} certifiers={certifiers || []} />
    </div>
  );
}
