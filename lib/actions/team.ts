"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { teamChanges } from "@/lib/roles";
import { recordAuditEvent } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/auth";

// Who, beyond the assigned certifier, works on a project. Set by the
// director from the project's page; the database (migration 0072) lets
// nobody else write the list and opens the project to whoever is on it.
export async function setJobTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const wanted = formData.getAll("certifier_id").map(String);

  const [{ data: job }, { data: current, error: readError }, { data: certifiers }] = await Promise.all([
    supabase.from("jobs").select("id, address, assigned_certifier_id").eq("id", jobId).eq("firm_id", profile.firm_id).single(),
    supabase.from("job_members").select("certifier_id").eq("job_id", jobId),
    supabase.from("certifiers").select("id, name").eq("firm_id", profile.firm_id),
  ]);
  if (!job) return { error: "That project could not be found." };
  if (readError) return { error: readError.code === "42P01" || readError.code === "PGRST205" ? "Run database update 0072 first (Settings → System check)." : readError.message };

  const known = new Set((certifiers || []).map((c) => c.id));
  const { add, remove } = teamChanges(
    (current || []).map((m) => m.certifier_id),
    wanted.filter((id) => known.has(id)),
    job.assigned_certifier_id
  );

  if (remove.length > 0) {
    const { error } = await supabase.from("job_members").delete().eq("job_id", jobId).in("certifier_id", remove);
    if (error) return { error: error.message };
  }
  if (add.length > 0) {
    const { error } = await supabase.from("job_members").insert(add.map((certifier_id) => ({ job_id: jobId, certifier_id })));
    if (error) return { error: error.message };
  }

  if (add.length > 0 || remove.length > 0) {
    const name = (id: string) => (certifiers || []).find((c) => c.id === id)?.name || "a certifier";
    await recordAuditEvent(supabase, {
      firmId: profile.firm_id,
      actor: profile,
      action: "job.team",
      jobId,
      jobAddress: job.address,
      summary: [add.length ? `Added ${add.map(name).join(", ")} to` : "", remove.length ? `${add.length ? "and removed" : "Removed"} ${remove.map(name).join(", ")} from` : ""]
        .filter(Boolean)
        .join(" ")
        .concat(` the team on ${job.address}`),
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  return { savedAt: Date.now() };
}
