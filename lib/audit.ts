import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/types/db";

// A written record of things that happened, kept separately from the
// things themselves.
//
// The Audit page used to work backwards from current state — it could
// tell you a certificate exists, but not that one was deleted, or that a
// date was changed, or that an email to a client never arrived. Anything
// undone left no trace at all, which is the opposite of what a log is
// for. These events are written as they happen and, by the table's own
// policies, cannot afterwards be edited or removed.

// The machine-readable name of what happened. Kept as a fixed list so
// the page can group and filter without matching on wording.
export type AuditAction =
  | "job.created"
  | "job.deleted"
  | "job.restored"
  | "job.purged"
  | "certificate.signed"
  | "certificate.sent"
  | "inspection.signed"
  | "inspection.deleted"
  | "oc.generated"
  | "portal.inspection"
  | "email.failed"
  | "backup.failed";

export type AuditSeverity = "info" | "warning" | "error";

export type RecordedAuditEvent = {
  id: string;
  job_id: string | null;
  job_address: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  action: AuditAction;
  summary: string;
  detail: Record<string, unknown> | null;
  severity: AuditSeverity;
  created_at: string;
};

// Postgres and PostgREST each have their own way of saying "there is no
// such table" — which is what happens on a deployment that is running
// ahead of its migrations. An audit write must never be the thing that
// breaks the action it is recording, so a missing table is ignored and
// everything else is reported to the console.
function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205" || code === "PGRST106";
}

// The table only lets a certifier's own login append to it, which is
// what keeps the log honest. But some of the things worth recording
// happen on the client's side of the app — a portal booking whose
// notification email bounces — and a client has no business writing to
// it directly. Those go in through the service role instead, which is
// server-only and never reachable from a browser.
function isNotPermitted(code: string | undefined): boolean {
  return code === "42501" || code === "PGRST301";
}

export async function recordAuditEvent(
  supabase: SupabaseClient,
  event: {
    firmId: string;
    action: AuditAction;
    summary: string;
    jobId?: string | null;
    jobAddress?: string | null;
    actor?: Profile | null;
    detail?: Record<string, unknown> | null;
    severity?: AuditSeverity;
  }
): Promise<void> {
  const row = {
    firm_id: event.firmId,
    job_id: event.jobId || null,
    job_address: event.jobAddress || null,
    actor_user_id: event.actor?.id || null,
    actor_name: event.actor?.full_name || event.actor?.email || null,
    action: event.action,
    summary: event.summary,
    detail: event.detail || null,
    severity: event.severity || "info",
  };

  const { error } = await supabase.from("audit_events").insert(row);
  if (!error) return;
  if (isMissingTable(error.code)) return;

  if (isNotPermitted(error.code) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { error: adminError } = await createAdminClient().from("audit_events").insert(row);
    if (!adminError || isMissingTable(adminError.code)) return;
    console.error("Could not record audit event:", adminError.message);
    return;
  }

  console.error("Could not record audit event:", error.message);
}

// The recorded events for a firm, newest first. Returns nothing rather
// than throwing when the table is not there yet, so the Audit page still
// renders its reconstructed history.
export async function getRecordedEvents(supabase: SupabaseClient, firmId: string, limit = 300): Promise<RecordedAuditEvent[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, job_id, job_address, actor_user_id, actor_name, action, summary, detail, severity, created_at")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!isMissingTable(error.code)) console.error("Could not read audit events:", error.message);
    return [];
  }
  return (data || []) as RecordedAuditEvent[];
}
