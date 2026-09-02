"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mergeJobDetailsInDb } from "@/lib/actions/mergeDetails";
import type { ActionState } from "@/lib/actions/auth";

// The standard CDC condition sets a firm issues under, and which one a
// job is approved subject to.
//
// The conditions themselves are statute — the department's own PDF —
// so Certlyn holds the file and the name the firm knows it by, and
// never tries to be the source of the words.

export async function addConditionSet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Give the condition set a name — it is what you will pick it by on a job." };

  const { count } = await supabase.from("cdc_condition_sets").select("id", { count: "exact", head: true }).eq("firm_id", profile.firm_id);
  const { error } = await supabase.from("cdc_condition_sets").insert({ firm_id: profile.firm_id, name, sort_order: count || 0 });
  if (error) return { error: conditionsError(error.code, error.message) };
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

// The uploaded PDF for one set. Its own action because an upload posts
// on its own, once the file is in storage.
export async function setConditionSetFile(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase
    .from("cdc_condition_sets")
    .update({ file_path: String(formData.get("file_path") || "") || null })
    .eq("id", String(formData.get("id")))
    .eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeConditionSet(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("cdc_condition_sets").delete().eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

// Which sets this job's certificate is issued subject to — as many as
// the development needs. The names are stored beside the ids: a set
// renamed or removed later must not change what an issued certificate
// says it was approved under.
export async function setJobConditionSets(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const asked = formData.getAll("set_id").map((v) => String(v)).filter(Boolean);

  if (asked.length === 0) {
    await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { cdcConditions: null });
    revalidatePath(`/jobs/${jobId}`);
    return { savedAt: Date.now() };
  }

  // Read back from the firm's own sets rather than trusting the form:
  // the ids came from a browser, and the names go on an approval.
  const { data: sets } = await supabase.from("cdc_condition_sets").select("id, name, sort_order").in("id", asked).eq("firm_id", profile.firm_id);
  const found = ((sets || []) as { id: string; name: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  if (found.length === 0) return { error: "Those condition sets could not be found." };

  await mergeJobDetailsInDb(supabase, jobId, profile.firm_id, { cdcConditions: found.map((s) => ({ setId: s.id, name: s.name })) });
  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}

function conditionsError(code: string | undefined, message: string): string {
  const missing = ["42P01", "PGRST205", "PGRST106"];
  return missing.includes(code || "") ? "Run database update 0070 first (Settings → System check)." : message;
}
