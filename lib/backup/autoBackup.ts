import { createAdminClient } from "@/lib/supabase/admin";
import { syncJob, type GeneratedDocument } from "@/lib/backup/sync";
import { ARCHIVE_SECTIONS } from "@/lib/archive/archivePaths";
import { buildApprovalSet } from "@/lib/pdf/approvalSet";
import { buildOcSet } from "@/lib/pdf/ocSet";
import { recordAuditEvent } from "@/lib/audit";
import type { Connection } from "@/lib/backup/connection";
import type { Profile } from "@/types/db";

// Copying a finished job to the firm's own cloud, without anyone
// remembering to.
//
// A backup that depends on a button being pressed is a backup that
// exists on the days somebody thought about it. The moment a certificate
// is released is the moment the job's records are worth keeping, so that
// is when the copy is made — every document the client sent, every
// inspection report and photo, and the finished set itself.
//
// Nothing here can fail loudly: a firm that has not connected any cloud
// storage simply has nothing to copy to, and a copy that fails must not
// undo the issuing of a certificate. Failures go to the audit log, where
// the certifier will see them.

export type AutoBackupReason = "pathway" | "oc";

// Every cloud a firm has connected, not one: a firm can hold both
// Dropbox and OneDrive, and a copy that only reached one of them is a
// firm that thinks it has two backups and has one.
async function connectionsFor(firmId: string): Promise<Connection[]> {
  try {
    const { data } = await createAdminClient().from("cloud_backup_connections").select("*").eq("firm_id", firmId);
    return (data as Connection[] | null) || [];
  } catch {
    // No table yet (migration not run) is the same as no connection.
    return [];
  }
}

// The generated sets worth keeping: the approved set as it was issued,
// and each Occupation Certificate set. Their markers carry the moment
// they were signed, so re-issuing a certificate copies the new one up
// rather than leaving last month's version as the firm's record.
async function generatedFor(reason: AutoBackupReason, jobId: string, profile: Profile): Promise<GeneratedDocument[]> {
  const admin = createAdminClient();

  if (reason === "pathway") {
    const { data: job } = await admin.from("jobs").select("pathway_signed_at, pathway_version").eq("id", jobId).maybeSingle();
    return [
      {
        folder: ARCHIVE_SECTIONS.approval,
        fileName: "Approved set.pdf",
        marker: `v${job?.pathway_version ?? 1}:${job?.pathway_signed_at || "unsigned"}`,
        build: async () => (await buildApprovalSet(jobId, profile))?.bytes || null,
      },
    ];
  }

  const { data: records } = await admin.from("oc_records").select("id, type, signed_at, generated_date").eq("job_id", jobId).order("created_at");
  return ((records || []) as { id: string; type: string; signed_at: string | null; generated_date: string | null }[])
    .filter((record) => record.signed_at || record.generated_date)
    .map((record) => ({
      folder: ARCHIVE_SECTIONS.approval,
      fileName: `${record.type === "whole" ? "Whole" : "Partial"} Occupation Certificate set.pdf`,
      marker: `${record.id}:${record.signed_at || record.generated_date}`,
      build: async () => (await buildOcSet(jobId, record.id, profile))?.bytes || null,
    }));
}

export async function backUpIssuedJob(jobId: string, profile: Profile, reason: AutoBackupReason): Promise<void> {
  try {
    const connections = await connectionsFor(profile.firm_id);
    if (connections.length === 0) return;

    // Built once and reused across every connection: a firm with two
    // clouds should not rebuild the same set twice.
    const generated = await generatedFor(reason, jobId, profile);

    for (const connection of connections) {
      let failure: string | null = null;
      let uploaded = 0;
      try {
        const result = await syncJob(connection, jobId, generated);
        uploaded = result.uploaded;
        if (result.failed.length > 0) {
          failure = `${result.failed.length} file${result.failed.length === 1 ? "" : "s"} could not be copied: ${result.failed[0].reason}`;
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : "the copy could not be made";
      }
      if (!failure) continue;

      // A backup nobody hears about failing is not a backup. This lands
      // on the Audit page like every other failure.
      const admin = createAdminClient();
      const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).maybeSingle();
      await recordAuditEvent(admin, {
        firmId: profile.firm_id,
        action: "backup.failed",
        summary: `Copy to ${connection.provider} after issuing: ${failure}`,
        jobId,
        jobAddress: (job as { address?: string } | null)?.address || null,
        detail: { uploaded, provider: connection.provider },
        severity: "error",
      });
    }
  } catch (error) {
    // A backup must never be the reason a certificate fails to issue.
    console.error("automatic backup failed", error instanceof Error ? error.message : error);
  }
}
