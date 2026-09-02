import type { SupabaseClient } from "@supabase/supabase-js";
import { removeFolder } from "@/lib/storage";
import { recordAuditEvent } from "@/lib/audit";

// Deleted projects go for good after thirty days — documents included.
//
// Deleting a project is recoverable on purpose: the row and every file
// stay, hidden, so a wrong click can be undone from Projects → Deleted.
// But "recoverable" quietly became "forever": a firm that deleted ten
// projects still paid for their documents, and the Storage page had to
// explain why. Thirty days is long enough to notice a mistake and short
// enough that a deleted project is not a permanent tenant.
//
// Runs from the morning sweep. Files first, then the row: a project
// whose files could not be removed keeps its row so the sweep tries
// again tomorrow, rather than leaving documents nothing can reach.

export const PURGE_AFTER_DAYS = 30;

// The moment before which a deleted project is old enough to go.
export function purgeCutoff(nowIso: string, days = PURGE_AFTER_DAYS): string {
  const at = new Date(nowIso);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString();
}

export type PurgeOutcome = { purged: number; failed: number };

export async function runDeletedJobPurge(admin: SupabaseClient, nowIso = new Date().toISOString()): Promise<PurgeOutcome> {
  const { data, error } = await admin
    .from("jobs")
    .select("id, firm_id, address, deleted_at")
    .not("deleted_at", "is", null)
    .lt("deleted_at", purgeCutoff(nowIso));
  if (error || !data) return { purged: 0, failed: 0 };

  const outcome: PurgeOutcome = { purged: 0, failed: 0 };
  for (const job of data as { id: string; firm_id: string; address: string | null }[]) {
    try {
      const { error: storageError } = await removeFolder(admin, "certflow-files", `${job.firm_id}/${job.id}`);
      if (storageError) {
        outcome.failed++;
        continue;
      }
      const { error: rowError } = await admin.from("jobs").delete().eq("id", job.id);
      if (rowError) {
        outcome.failed++;
        continue;
      }
      // Written once it is actually gone, so a project the sweep has to
      // come back for is not recorded as purged twice.
      await recordAuditEvent(admin, {
        firmId: job.firm_id,
        action: "job.purged",
        summary: `Permanently deleted the project at ${job.address || "(no address)"}, including its documents — ${PURGE_AFTER_DAYS} days after it was deleted`,
        jobId: job.id,
        jobAddress: job.address,
        severity: "warning",
      });
      outcome.purged++;
    } catch {
      outcome.failed++;
    }
  }
  return outcome;
}
