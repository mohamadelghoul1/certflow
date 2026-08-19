"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { INSPECTION_LIBRARY, MANDATORY_CRITICAL_STAGE_INSPECTIONS, epiForCodeParts } from "@/lib/constants";
import { todayISO } from "@/lib/business";
import { notifyJobClient } from "@/lib/email";
import type { ActionState } from "@/lib/actions/auth";
import type { JobDetails } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Not exported — a plain helper, not a server action — even though this
// file is "use server". Reads the firm's own editable document library
// (Settings -> Document Library) instead of a fixed list shared by every firm.
async function firmLibrary(supabase: SupabaseClient, firmId: string, pathway: string) {
  const { data } = await supabase
    .from("document_library_items")
    .select("title, description, category")
    .eq("firm_id", firmId)
    .eq("pathway", pathway)
    .order("sort_order");
  return data || [];
}

// Shared by the New Job intake form and the Details-tab edit form — same
// full field set as the prototype's single JobForm (used for both create
// and edit). CDC's relevant instrument/part of code are computed from the
// ticked SEPP code parts rather than typed in directly.
function extractJobDetails(formData: FormData, pathway: string): JobDetails {
  const codeParts = formData.getAll("codeParts").map(String);
  const relevantInstrument = pathway === "CDC" && codeParts.length > 0 ? epiForCodeParts(codeParts) : String(formData.get("relevantInstrument") || "");
  const relevantPartOfCode = pathway === "CDC" && codeParts.length > 0 ? codeParts.join(", ") : String(formData.get("relevantPartOfCode") || "");

  return {
    projectNumber: String(formData.get("projectNumber") || ""),
    zoning: String(formData.get("zoning") || ""),
    bcaVersion: String(formData.get("bcaVersion") || ""),
    contact: {
      nameOrCompany: String(formData.get("contact_nameOrCompany") || ""),
      title: String(formData.get("contact_title") || ""),
      givenNames: String(formData.get("contact_givenNames") || ""),
      surname: String(formData.get("contact_surname") || ""),
      phone: String(formData.get("contact_phone") || ""),
      fax: String(formData.get("contact_fax") || ""),
      mobile: String(formData.get("contact_mobile") || ""),
      email: String(formData.get("contact_email") || ""),
    },
    applicantAddress: {
      streetNumber: String(formData.get("applicantAddress_streetNumber") || ""),
      street: String(formData.get("applicantAddress_street") || ""),
      suburb: String(formData.get("applicantAddress_suburb") || ""),
      state: String(formData.get("applicantAddress_state") || "NSW"),
      postcode: String(formData.get("applicantAddress_postcode") || ""),
    },
    ownerSameAsApplicant: formData.get("ownerSameAsApplicant") === "on",
    owner: {
      name: String(formData.get("owner_name") || ""),
      phone: String(formData.get("owner_phone") || ""),
      address: {
        streetNumber: String(formData.get("owner_streetNumber") || ""),
        street: String(formData.get("owner_street") || ""),
        suburb: String(formData.get("owner_suburb") || ""),
        state: String(formData.get("owner_state") || "NSW"),
        postcode: String(formData.get("owner_postcode") || ""),
      },
    },
    council: {
      lga: String(formData.get("council_lga") || ""),
      address: {
        streetNumber: String(formData.get("council_streetNumber") || ""),
        street: String(formData.get("council_street") || ""),
        suburb: String(formData.get("council_suburb") || ""),
        state: String(formData.get("council_state") || "NSW"),
        postcode: String(formData.get("council_postcode") || ""),
      },
      contact: {
        phone: String(formData.get("council_phone") || ""),
        fax: String(formData.get("council_fax") || ""),
        email: String(formData.get("council_email") || ""),
      },
    },
    proposal: {
      classifications: formData.getAll("classifications").map(String),
      constructionType: String(formData.get("constructionType") || "N/A"),
      dwellingsExisting: String(formData.get("dwellingsExisting") || ""),
      dwellingsDemolished: String(formData.get("dwellingsDemolished") || ""),
      dwellingsNew: String(formData.get("dwellingsNew") || ""),
      estimatedCost: String(formData.get("estimatedCost") || ""),
      storeysAbove: String(formData.get("storeysAbove") || ""),
      storeysBelow: String(formData.get("storeysBelow") || ""),
      storeysTotal: String(formData.get("storeysTotal") || ""),
      effectiveHeight: String(formData.get("effectiveHeight") || ""),
      floorAreaExisting: String(formData.get("floorAreaExisting") || ""),
      floorAreaNew: String(formData.get("floorAreaNew") || ""),
    },
    siteArea: String(formData.get("siteArea") || ""),
    buildingDescription: String(formData.get("buildingDescription") || ""),
    certificateDetails: {
      lotSectionDp: String(formData.get("lotSectionDp") || ""),
      planningPortalRef: String(formData.get("planningPortalRef") || ""),
      relevantInstrument,
      relevantPartOfCode,
      codeParts,
      determinationDate: String(formData.get("determinationDate") || ""),
    },
  };
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const pathway = String(formData.get("pathway") || "CDC") as "CDC" | "CC";
  const jobTypes = formData.getAll("job_types").map(String);
  const clientId = String(formData.get("client_id") || "") || null;
  const certifierId = String(formData.get("assigned_certifier_id") || "") || null;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      firm_id: profile.firm_id,
      address: String(formData.get("address") || ""),
      description: String(formData.get("description") || ""),
      job_types: jobTypes,
      pathway,
      assigned_certifier_id: certifierId,
      client_id: clientId,
      details: extractJobDetails(formData, pathway),
      critical_stage_inspections: MANDATORY_CRITICAL_STAGE_INSPECTIONS.map((i) => i.no),
    })
    .select("id")
    .single();

  if (error || !job) return { error: error?.message || "Could not create job." };

  // Auto-populate the three standard checklists from the firm's own
  // document library (Settings -> Document Library).
  const kinds: { kind: "pathway" | "noc" | "oc"; libraryKey: string }[] = [
    { kind: "pathway", libraryKey: pathway },
    { kind: "noc", libraryKey: "NOC" },
    { kind: "oc", libraryKey: "OC" },
  ];

  for (const { kind, libraryKey } of kinds) {
    const { data: checklist } = await supabase.from("checklists").insert({ job_id: job.id, kind }).select("id").single();
    if (!checklist) continue;
    const library = await firmLibrary(supabase, profile.firm_id, libraryKey);
    const items = library.map((doc, idx) => ({
      checklist_id: checklist.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      sort_order: idx,
    }));
    if (items.length) await supabase.from("checklist_items").insert(items);
  }

  const inspections = INSPECTION_LIBRARY.map((i) => ({
    job_id: job.id,
    title: i.title,
    description: i.desc,
    inspector_certifier_id: certifierId,
  }));
  await supabase.from("inspections").insert(inspections);

  redirect(`/jobs/${job.id}`);
}

export async function updateJobDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const pathway = String(formData.get("pathway") || "CDC");

  const details = extractJobDetails(formData, pathway);

  await supabase.from("jobs").update({ details }).eq("id", jobId).eq("firm_id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function removeChecklistItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").delete().eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addChecklistItems(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const checklistId = String(formData.get("checklist_id"));
  const jobId = String(formData.get("job_id"));
  const titles = formData.getAll("title").map(String);
  const descs = formData.getAll("desc").map(String);
  const categories = formData.getAll("category").map(String);

  const { data: checklist } = await supabase.from("checklists").select("id, jobs!inner(firm_id)").eq("id", checklistId).single();
  if (!checklist) return;

  const items = titles.map((title, i) => ({
    checklist_id: checklistId,
    title,
    description: descs[i] || "",
    category: categories[i] || "Other",
  }));
  if (items.length) await supabase.from("checklist_items").insert(items);
  revalidatePath(`/jobs/${jobId}`);
}

export async function approveItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  // No automatic email here on purpose — approvals/amendments happen too
  // often to email on each one. Use the "Notify client of update" button
  // on the checklist instead, which sends one batched summary.
  await supabase.from("checklist_items").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function certifierUploadItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  await supabase
    .from("checklist_items")
    .update({ file_path: filePath, status: "submitted", version: undefined as never })
    .eq("id", itemId);
  // version bump done via RPC-free direct read+write to avoid a race in this admin path:
  const { data: item } = await supabase.from("checklist_items").select("version").eq("id", itemId).single();
  if (item) await supabase.from("checklist_items").update({ version: (item.version || 0) + 1 }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateItemMeta(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase
    .from("checklist_items")
    .update({
      revision: String(formData.get("revision") || ""),
      document_date: formData.get("document_date") || null,
      prepared_by: String(formData.get("prepared_by") || ""),
      drawing_number: String(formData.get("drawing_number") || ""),
      clause_ref: String(formData.get("clause_ref") || ""),
    })
    .eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleStamping(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const value = formData.get("value") === "true";
  await supabase.from("checklist_items").update({ requires_stamping: value }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addAmendment(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  // No automatic email here on purpose — see note in approveItem above.
  await supabase.from("amendments").insert({ checklist_item_id: itemId, text });
  revalidatePath(`/jobs/${jobId}`);
}

// Manual, batched notification — one summary email per click, instead of
// one email per approval/amendment. Mirrors the prototype's
// buildJobUpdateMailto: "X of Y documents approved — Z items need your
// attention", not a blow-by-blow log.
export async function notifyClientOfChecklist(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const checklistId = String(formData.get("checklist_id"));
  const label = String(formData.get("label") || "your project");

  const { data: items } = await supabase.from("checklist_items").select("status, amendments(resolved)").eq("checklist_id", checklistId);

  const total = items?.length || 0;
  const approved = (items || []).filter((i) => i.status === "approved").length;
  const openAmendments = (items || []).reduce((sum, i) => sum + (i.amendments || []).filter((a: { resolved: boolean }) => !a.resolved).length, 0);

  let statusLine = total > 0 ? `${approved} of ${total} documents approved` : "No documents requested yet";
  if (openAmendments > 0) statusLine += ` — ${openAmendments} item${openAmendments === 1 ? "" : "s"} require your attention`;

  await notifyJobClient(
    supabase,
    jobId,
    `${label} — status update`,
    `<p>Here&rsquo;s the current status of the <strong>${label}</strong> checklist:</p><p style="padding:12px;background:#f0fdfa;border-radius:6px">${statusLine}</p>`
  );

  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

// Generic one-off milestone notification — used by the manual "Notify
// client" buttons next to a certificate/report once it's ready, instead
// of firing automatically the moment it's uploaded/marked sent.
export async function notifyClientMessage(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const subject = String(formData.get("subject") || "Update on your project");
  const message = String(formData.get("message") || "");

  await notifyJobClient(supabase, jobId, subject, `<p>${message}</p>`);
  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function resolveAmendment(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const amendmentId = String(formData.get("amendment_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("amendments").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", amendmentId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addCondition(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  await supabase.from("conditions_of_consent").insert({ job_id: jobId, text, date_added: todayISO() });
  revalidatePath(`/jobs/${jobId}`);
  void profile;
}

export async function removeCondition(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const conditionId = String(formData.get("condition_id"));
  await supabase.from("conditions_of_consent").delete().eq("id", conditionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reopenItem(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const itemId = String(formData.get("item_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("checklist_items").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("id", itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function issuePathwayCertificate(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const certifierId = String(formData.get("certifier_id"));
  const { data: job } = await supabase.from("jobs").select("pathway_version").eq("id", jobId).single();
  await supabase
    .from("jobs")
    .update({
      pathway_generated: true,
      pathway_generated_date: todayISO(),
      pathway_issued_by: certifierId,
      pathway_version: (job?.pathway_version || 0) + 1,
      pathway_approval_uploaded: false,
      pathway_approval_date: null,
      pathway_approval_file_path: null,
    })
    .eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function uploadPathwayApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  await supabase
    .from("jobs")
    .update({ pathway_approval_uploaded: true, pathway_approval_date: todayISO(), pathway_approval_file_path: filePath })
    .eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function startModification(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const reason = String(formData.get("reason") || "");
  const pathway = String(formData.get("pathway") || "CDC");

  const { data: mod } = await supabase.from("modifications").insert({ job_id: jobId, reason }).select("id").single();
  if (!mod) return;
  const { data: checklist } = await supabase.from("checklists").insert({ job_id: jobId, kind: "modification", modification_id: mod.id }).select("id").single();
  if (checklist) {
    const library = await firmLibrary(supabase, profile.firm_id, pathway);
    const items = library.map((doc, idx) => ({
      checklist_id: checklist.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      sort_order: idx,
    }));
    if (items.length) await supabase.from("checklist_items").insert(items);
  }
  revalidatePath(`/jobs/${jobId}`);
  void profile;
}

export async function issueModification(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const certifierId = String(formData.get("certifier_id"));
  const { data: mod } = await supabase.from("modifications").select("version").eq("id", modificationId).single();
  await supabase
    .from("modifications")
    .update({ generated: true, generated_date: todayISO(), issued_by: certifierId, version: (mod?.version || 0) + 1 })
    .eq("id", modificationId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function uploadModificationApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const modificationId = String(formData.get("modification_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("modifications").update({ approval_uploaded: true, approval_date: todayISO(), approval_file_path: filePath }).eq("id", modificationId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function issueOc(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const type = String(formData.get("type")) as "partial" | "whole";
  const description = String(formData.get("description") || "");
  const certifierId = String(formData.get("certifier_id"));
  await supabase.from("oc_records").insert({ job_id: jobId, type, description, generated_date: todayISO(), issued_by: certifierId });
  revalidatePath(`/jobs/${jobId}`);
}

export async function uploadOcApproval(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const ocId = String(formData.get("oc_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("oc_records").update({ approval_uploaded: true, approval_date: todayISO(), approval_file_path: filePath }).eq("id", ocId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function markJobComplete(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "complete" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reopenJob(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ status: "active" }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function assignJobClient(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const clientId = String(formData.get("client_id") || "") || null;
  await supabase.from("jobs").update({ client_id: clientId }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

// Both blank by default — the certificate package falls back to a standard
// letter body (see app/certificate/pathway/[jobId]/page.tsx) unless the
// certifier has overridden it here for this specific job.
export async function updateCouncilLetter(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ council_letter_override: String(formData.get("text") || "") }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateApplicantLetter(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  await supabase.from("jobs").update({ applicant_letter_override: String(formData.get("text") || "") }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleCriticalStageInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const no = Number(formData.get("no"));
  const { data: job } = await supabase.from("jobs").select("critical_stage_inspections").eq("id", jobId).single();
  const current: number[] = job?.critical_stage_inspections || [];
  const next = current.includes(no) ? current.filter((n) => n !== no) : [...current, no].sort((a, b) => a - b);
  await supabase.from("jobs").update({ critical_stage_inspections: next }).eq("id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}
