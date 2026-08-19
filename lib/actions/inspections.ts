"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/business";

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

export async function confirmBooking(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").update({ confirmed: true }).eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeInspection(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const inspectionId = String(formData.get("inspection_id"));
  const jobId = String(formData.get("job_id"));
  await supabase.from("inspections").delete().eq("id", inspectionId);
  revalidatePath(`/jobs/${jobId}`);
}
