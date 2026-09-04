"use server";

import { revalidatePath } from "next/cache";
import { requireJobWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mergeJobDetailsInDb } from "@/lib/actions/mergeDetails";
import { notifyJobClient } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit";
import { clientFacing, outstandingStages, outstandingTotal, type OutstandingChecklistRow } from "@/lib/outstandingDocuments";
import { aiConfigured, askForDescriptions, assembleSummary, describeAiError, summaryToHtml } from "@/lib/ai/outstandingSummary";
import type { NotifyState } from "@/lib/actions/jobs";
import type { Pathway } from "@/lib/business";
import type { JobDetails } from "@/types/db";

// The note to the client about what is still needed: written, kept,
// changed, sent. Each is its own step and only the last one leaves the
// building.

export type SummaryState = { error?: string; savedAt?: number; notice?: string } | undefined;

type JobRow = { id: string; firm_id: string; address: string; pathway: Pathway; description: string | null; checklists: OutstandingChecklistRow[] };

async function loadJob(jobId: string, firmId: string): Promise<JobRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, firm_id, address, pathway, description, checklists(kind, modification_id, checklist_items(*, amendments(resolved)))")
    .eq("id", jobId)
    .eq("firm_id", firmId)
    .single();
  return (data as unknown as JobRow | null) || null;
}

type Summary = NonNullable<JobDetails["outstandingSummary"]>;

async function store(jobId: string, firmId: string, summary: Summary) {
  const supabase = await createClient();
  await mergeJobDetailsInDb(supabase, jobId, firmId, { outstandingSummary: summary });
  revalidatePath(`/jobs/${jobId}`);
}

// The certifier's own changes keep the date the note was written: the
// date says when the AI (or the standard wording) drew it up, and the
// page treats a new date as a new note — it would throw away what is
// on screen, confirmation and all, to show it.
async function keepEdit(jobId: string, firmId: string, text: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("details").eq("id", jobId).eq("firm_id", firmId).single();
  const existing = ((data?.details as JobDetails | null) || {}).outstandingSummary || null;
  if (existing?.text === text) return;
  await store(jobId, firmId, { text, generatedAt: existing?.generatedAt || new Date().toISOString(), written: "edited" });
}

// Writes the note afresh from the checklists as they stand now. With a
// key, the AI explains each document; without one, the library's own
// descriptions do — and the certifier is told which they got.
export async function writeOutstandingSummary(_prev: SummaryState, formData: FormData): Promise<SummaryState> {
  const { profile } = await requireJobWriter();
  const jobId = String(formData.get("job_id"));
  const job = await loadJob(jobId, profile.firm_id);
  if (!job) return { error: "Project not found." };

  const stages = clientFacing(outstandingStages(job.checklists || [], job.pathway));
  if (outstandingTotal(stages) === 0) return { error: "Nothing is outstanding from the client on this project." };

  if (!aiConfigured()) {
    await store(jobId, profile.firm_id, { text: assembleSummary(stages, null), generatedAt: new Date().toISOString(), written: "standard" });
    return { savedAt: Date.now(), notice: "Written with the standard wording — no AI key is set up yet." };
  }

  try {
    const written = await askForDescriptions({ pathway: job.pathway, worksDescription: job.description, stages });
    await store(jobId, profile.firm_id, { text: assembleSummary(stages, written), generatedAt: new Date().toISOString(), written: "ai" });
    return { savedAt: Date.now() };
  } catch (error) {
    return { error: describeAiError(error) };
  }
}

export async function saveOutstandingSummary(_prev: SummaryState, formData: FormData): Promise<SummaryState> {
  const { profile } = await requireJobWriter();
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return { error: "The note is empty — write something, or use the Write button." };
  await keepEdit(jobId, profile.firm_id, text);
  return { savedAt: Date.now() };
}

// Sends what is in the box, not what was last saved: the certifier's
// final read-through is the version that goes.
export async function sendOutstandingSummary(_prev: NotifyState, formData: FormData): Promise<NotifyState> {
  const { profile } = await requireJobWriter();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return { error: "There is nothing to send yet." };

  const { data: job } = await supabase.from("jobs").select("address").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  const outcome = await notifyJobClient(supabase, jobId, `Documents still needed — ${job.address}`, summaryToHtml(text));
  if (!outcome.sent) return { error: outcome.reason || "The email could not be sent." };

  await supabase.from("jobs").update({ last_notified_at: new Date().toISOString() }).eq("id", jobId);
  await keepEdit(jobId, profile.firm_id, text);
  await recordAuditEvent(supabase, {
    firmId: profile.firm_id,
    action: "client.summary",
    summary: "Sent the client a note on the documents still needed",
    jobId,
    jobAddress: job.address,
    actor: profile,
  });
  return { success: "Email sent to the client." };
}
