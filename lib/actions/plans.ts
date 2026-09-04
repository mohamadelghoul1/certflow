"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePlatformOwner } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DEFAULT_PLAN } from "@/lib/billing";
import type { ActionState } from "@/lib/actions/auth";

const NOT_RUN = "Run database update 0076 first (Settings → System check).";

function missing(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "PGRST106";
}

// Dollars in the form, cents in the database — no arithmetic on a
// bill should ever meet a rounding error.
function cents(formData: FormData, name: string, fallback: number): number {
  const raw = String(formData.get(name) || "").replace(/[$,\s]/g, "");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value * 100);
}

function whole(formData: FormData, name: string, fallback: number): number {
  const value = Number(String(formData.get(name) || "").trim());
  if (!Number.isInteger(value) || value < 0) return fallback;
  return value;
}

// The terms a firm is on. Only the firm that runs Certlyn sets these,
// and the database says so too (migration 0076).
export async function saveFirmPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformOwner();
  const supabase = await createClient();
  const firmId = String(formData.get("firm_id"));
  const startedOn = String(formData.get("started_on") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) return { error: "Give the date the arrangement starts, as a date." };

  const { error } = await supabase.from("firm_plans").upsert(
    {
      firm_id: firmId,
      started_on: startedOn,
      intro_months: whole(formData, "intro_months", DEFAULT_PLAN.intro_months),
      intro_fee_cents: cents(formData, "intro_fee", DEFAULT_PLAN.intro_fee_cents),
      standard_fee_cents: cents(formData, "standard_fee", DEFAULT_PLAN.standard_fee_cents),
      included_projects: whole(formData, "included_projects", DEFAULT_PLAN.included_projects),
      extra_project_fee_cents: cents(formData, "extra_project_fee", DEFAULT_PLAN.extra_project_fee_cents),
      notes: String(formData.get("notes") || "").trim().slice(0, 2000) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id" }
  );
  if (error) return { error: missing(error.code) ? NOT_RUN : error.message };

  revalidatePath("/platform");
  return { savedAt: Date.now() };
}
