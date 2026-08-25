import type { SupabaseClient } from "@supabase/supabase-js";
import { deepMergeDetails } from "@/lib/jobDetails";

// Changes part of a job's details without reading the rest first.
//
// Several places write into the same jsonb column, and each of them used
// to read the whole record, change its own field and write the whole
// thing back. Two of those landing close together and the second wrote
// over the first, from a copy taken before the first had arrived. The
// merge now happens inside the update statement, so there is nothing to
// read and nothing to race.
//
// A patch says only what to change. A key it does not mention is left
// alone; a key set to null is removed.
export async function mergeJobDetailsInDb(supabase: SupabaseClient, jobId: string, firmId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc("merge_job_details", { p_job_id: jobId, p_patch: patch });
  if (!error) return;

  // Before migration 0029 there is no such function. Falling back to the
  // old read-then-write keeps the app working on a database that is
  // running behind the deployment — with the race it always had, which
  // is no worse than before.
  if (error.code !== "PGRST202" && error.code !== "42883") {
    throw new Error(error.message);
  }

  const { data: job } = await supabase.from("jobs").select("details").eq("id", jobId).eq("firm_id", firmId).single();
  const merged = deepMergeDetails(job?.details || {}, patch);
  await supabase.from("jobs").update({ details: merged }).eq("id", jobId).eq("firm_id", firmId);
}
