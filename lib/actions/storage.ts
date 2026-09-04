"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFolder } from "@/lib/storage";
import { getStorageUsage, formatBytes } from "@/lib/storageUsage";
import { recordAuditEvent } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/auth";

// Clearing out documents belonging to projects that no longer exist.
//
// Purging a project was supposed to take its files with it and, until
// this was fixed, silently did not — so a firm can be carrying the
// documents of every project it ever deleted. This removes them.
//
// Deliberately not automatic. These are documents, and a certifier holds
// records for years; deciding they are gone is theirs to make, not a
// sweep that runs overnight.
export async function clearOrphanedFiles(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
  const supabase = await createClient();

  // Worked out here rather than taken from the form: a folder id posted
  // by a browser is not proof that no project owns it, and deleting
  // documents on that word would be deleting a live project's records.
  const usage = await getStorageUsage(supabase, profile.firm_id);
  if (!usage.available) return { error: "The storage report is not available, so nothing has been deleted." };

  const orphans = usage.jobs.filter((j) => !j.isProject && j.address === "Deleted project");
  if (orphans.length === 0) return { error: "There are no files from deleted projects to clear." };

  // One folder at a time when asked for one, everything when asked for
  // everything — the page offers both.
  const asked = String(formData.get("folder") || "");
  const targets = asked ? orphans.filter((o) => o.jobId === asked) : orphans;
  if (targets.length === 0) return { error: "That folder is not one of the deleted projects." };

  let removed = 0;
  let bytes = 0;
  for (const target of targets) {
    const result = await removeFolder(supabase, "certflow-files", `${profile.firm_id}/${target.jobId}`);
    removed += result.removed;
    if (result.removed > 0) bytes += target.bytes;
    if (result.error) {
      await recordAuditEvent(createAdminClient(), {
        firmId: profile.firm_id,
        action: "documents.pruned",
        summary: `Clearing files from a deleted project stopped part-way: ${result.error}`,
        detail: { removed, folder: target.jobId },
        severity: "error",
      });
      revalidatePath("/settings");
      return { error: `Removed ${removed} file${removed === 1 ? "" : "s"}, then stopped: ${result.error}` };
    }
  }

  // Deleting documents is worth a line in the log whoever did it, and
  // however sure they were.
  await recordAuditEvent(createAdminClient(), {
    firmId: profile.firm_id,
    action: "documents.pruned",
    summary: `Cleared ${removed} file${removed === 1 ? "" : "s"} (${formatBytes(bytes)}) belonging to ${targets.length} deleted project${targets.length === 1 ? "" : "s"}`,
    detail: { removed, folders: targets.length },
    severity: "warning",
  });

  revalidatePath("/settings");
  return undefined;
}
