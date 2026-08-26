"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseTable } from "@/lib/import/parseTable";
import { buildPreview } from "@/lib/import/jobRows";
import { setUpJob } from "@/lib/jobSetup";
import { recordAuditEvent } from "@/lib/audit";
import { defaultCriticalStageInspections } from "@/lib/constants";

// Bringing a firm's existing jobs across from whatever system they were
// in before.
//
// These are jobs already under construction: someone else issued the
// certificate, and this firm is taking over the inspections and the
// occupation certificate. Every imported row becomes a PC/OC job with
// the previous approval recorded against it, set up with the same
// checklists and inspections as a job created by hand.

export type ImportResult = { error?: string; created?: number; skipped?: string[] };

export async function importJobs(_prev: ImportResult | undefined, formData: FormData): Promise<ImportResult> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const pasted = String(formData.get("pasted") || "");
  const certifierId = String(formData.get("assigned_certifier_id") || "") || null;
  if (!certifierId) return { error: "Choose which certifier these projects belong to." };

  const table = parseTable(pasted);
  if (!table) return { error: "That does not look like a spreadsheet — paste the heading row and at least one project." };

  const { jobs } = buildPreview(table);
  const wanted = jobs.filter((job) => job.address);
  if (wanted.length === 0) return { error: "None of those rows carry a property address." };

  // A firm importing twice — a second export, a re-paste after a
  // correction — must not end up with the same job twice. Matching on
  // address is imperfect but it is what a certifier would compare, and
  // skipping is always safer than duplicating.
  const { data: existing } = await supabase.from("jobs").select("address").eq("firm_id", profile.firm_id);
  const alreadyHere = new Set((existing || []).map((job) => (job.address || "").trim().toLowerCase()));

  const skipped: string[] = [];
  let created = 0;

  for (const job of wanted) {
    if (alreadyHere.has(job.address.trim().toLowerCase())) {
      skipped.push(`Row ${job.rowNumber}: ${job.address} — a project at this address already exists`);
      continue;
    }

    const { data: row, error } = await supabase
      .from("jobs")
      .insert({
        firm_id: profile.firm_id,
        address: job.address,
        description: job.description,
        job_types: [],
        pathway: "PC_OC",
        assigned_certifier_id: certifierId,
        client_id: null,
        details: job.details,
        critical_stage_inspections: defaultCriticalStageInspections(),
      })
      .select("id")
      .single();

    if (error || !row) {
      skipped.push(`Row ${job.rowNumber}: ${job.address} — ${error?.message || "could not be created"}`);
      continue;
    }

    await setUpJob(supabase, profile.firm_id, row.id, "PC_OC", certifierId);
    alreadyHere.add(job.address.trim().toLowerCase());
    created++;
  }

  if (created > 0) {
    await recordAuditEvent(supabase, {
      firmId: profile.firm_id,
      action: "job.created",
      summary: `Imported ${created} ${created === 1 ? "project" : "projects"} from another certification system`,
      actor: profile,
      detail: { created, skipped: skipped.length },
    });
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { created, skipped };
}
