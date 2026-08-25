"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";
import { inspectionDescriptionFor } from "@/lib/constants";

export async function assignInspector(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const certifierId = String(formData.get("certifier_id") || "") || null;
  await supabase.from("inspections").update({ inspector_certifier_id: certifierId }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function setInspectionDate(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const date = String(formData.get("date") || "") || null;
  await supabase.from("inspections").update({ date, confirmed: true }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function recordOutcome(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const outcome = String(formData.get("outcome"));
  await supabase.from("inspections").update({ outcome, updated_at: new Date().toISOString() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// The two prose parts of the generated report. Blank intro means "use the
// standard wording" rather than "print nothing", so clearing the box
// restores the default instead of leaving a gap.
export async function updateInspectionReportText(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const introOverride = String(formData.get("report_intro_override") || "").trim() || null;
  const notes = String(formData.get("report_notes") || "").trim() || null;

  await supabase.from("inspections").update({ report_intro_override: introOverride, report_notes: notes, updated_at: new Date().toISOString() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs/[jobId]/inspections/[inspectionId]/report", "page");
}

export async function addDefect(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  await supabase.from("defects").insert({ inspection_id: inspectionId, text });
  revalidatePath(`/jobs/${jobId}`);
}

export async function resolveDefect(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const defectId = String(formData.get("defect_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("defects").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", defectId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function sendReport(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").update({ report_sent: true, report_sent_date: todayISO() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function uploadInspectionReport(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  await supabase
    .from("inspections")
    .update({ report_file_path: filePath, report_sent: true, report_sent_date: todayISO() })
    .eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function signInspectionReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const { error, data } = await supabase.from("inspections").update({ report_signed_at: new Date().toISOString() }).eq("id", inspectionId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not find this inspection to sign." };
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/inspections/${inspectionId}/report`);
  return undefined;
}

export async function confirmBooking(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").update({ confirmed: true }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

// An inspection the job needs beyond the standard set: an occasional one
// (pool steel, a suspended slab, an OSD system, a fire rated wall), or a
// stage that has to be carried out a second time. Free text rather than a
// fixed list — the suggestions offered in the form are a shortcut, not a
// limit — because no list of stages covers every job.
export async function addInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "Give the inspection a name." };

  // Scoped to the firm, the same way every other action that writes
  // against a job is.
  const { data: job } = await supabase.from("jobs").select("id, assigned_certifier_id").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const description = inspectionDescriptionFor(title);
  const { error } = await supabase.from("inspections").insert({
    job_id: jobId,
    title,
    description: description || null,
    // Whoever the job is assigned to, as the starter inspections are —
    // it can be changed on the card like any other.
    inspector_certifier_id: job.assigned_certifier_id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return undefined;
}

export async function removeInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").delete().eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addPhoto(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("inspection_photos").insert({ inspection_id: inspectionId, file_path: filePath });
  revalidatePath(`/jobs/${jobId}`);
}

export async function setPhotoCaption(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const photoId = String(formData.get("photo_id"));
  const jobId = String(formData.get("job_id"));
  const caption = String(formData.get("caption") || "");
  await supabase.from("inspection_photos").update({ caption }).eq("id", photoId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removePhoto(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const photoId = String(formData.get("photo_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspection_photos").delete().eq("id", photoId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function reportToPortal(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").update({ portal_reported: true, portal_reported_date: todayISO() }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}
