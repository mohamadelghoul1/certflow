import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIOR_APPROVAL_DOCUMENTS, INSPECTION_LIBRARY } from "@/lib/constants";
import { insertChecklistItems } from "@/lib/checklists";

// Everything a job needs behind it once its row exists: the three
// checklists filled from the firm's own document library, and the
// standard inspections.
//
// Shared by the New Project form and the importer, so a job that arrives
// from another system is set up exactly like one created by hand —
// there is no such thing as a second-class imported job.

export async function firmLibrary(supabase: SupabaseClient, firmId: string, pathway: string) {
  const { data } = await supabase
    .from("document_library_items")
    .select("id, title, description, category")
    .eq("firm_id", firmId)
    .eq("pathway", pathway)
    .order("sort_order");
  return data || [];
}

export async function setUpJob(supabase: SupabaseClient, firmId: string, jobId: string, pathway: string, certifierId: string | null) {
  const kinds: { kind: "pathway" | "noc" | "oc"; libraryKey: string }[] = [
    { kind: "pathway", libraryKey: pathway },
    { kind: "noc", libraryKey: "NOC" },
    { kind: "oc", libraryKey: "OC" },
  ];

  for (const { kind, libraryKey } of kinds) {
    const { data: checklist } = await supabase.from("checklists").insert({ job_id: jobId, kind }).select("id").single();
    if (!checklist) continue;
    // A PC/OC job has no application to assess, so its first checklist
    // collects the previous certifier's approval instead of this firm's
    // document library for a pathway it never follows.
    const library = libraryKey === "PC_OC" ? PRIOR_APPROVAL_DOCUMENTS : await firmLibrary(supabase, firmId, libraryKey);
    const items = library.map((doc, idx) => ({
      checklist_id: checklist.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      sort_order: idx,
      template_library_item_id: "id" in doc ? doc.id : null,
    }));
    await insertChecklistItems(supabase, items);
  }

  await supabase.from("inspections").insert(
    INSPECTION_LIBRARY.map((i, idx) => ({
      job_id: jobId,
      title: i.title,
      description: i.desc,
      inspector_certifier_id: certifierId,
      sort_order: idx,
    }))
  );
}
