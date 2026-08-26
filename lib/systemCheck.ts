import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnknownColumn } from "@/lib/softDelete";
import { emailConfigured } from "@/lib/email";
import { portalConfigured } from "@/lib/portal/config";

// Whether this database has actually had each migration run against it.
//
// The app is deployed the moment it is pushed; the SQL is run by hand
// afterwards, in Supabase. Between the two, features quietly do not
// work — and the failure looks like a bug in the app rather than a step
// that was missed. Each check asks the database one cheap question that
// only that migration's change can answer, so a half-migrated
// deployment says so on the Settings page instead of being a mystery.
//
// Nothing here runs SQL of its own. The app has no business executing
// arbitrary statements against its own schema; it can only look.

export type SystemCheck = { migration: string; label: string; detail: string; applied: boolean };

const MISSING_TABLE = ["42P01", "PGRST205", "PGRST106"];
const MISSING_FUNCTION = ["PGRST202", "42883"];

async function hasColumn(supabase: SupabaseClient, table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !isUnknownColumn(error) && !MISSING_TABLE.includes(error?.code || "");
}

async function hasTable(supabase: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("*").limit(1);
  return !MISSING_TABLE.includes(error?.code || "");
}

// A function is probed by calling it. Every one probed here refuses a
// caller in the wrong role before it touches anything, so the call
// changes nothing — an error that is not "no such function" means the
// function is there and did its job.
async function hasFunction(supabase: SupabaseClient, name: string, args: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.rpc(name, args);
  return !MISSING_FUNCTION.includes(error?.code || "");
}

export async function runSystemChecks(supabase: SupabaseClient): Promise<SystemCheck[]> {
  const checks: { migration: string; label: string; detail: string; probe: Promise<boolean> }[] = [
    {
      migration: "0022",
      label: "Inspection ordering",
      detail: "Lets inspections be moved up and down the list.",
      probe: hasColumn(supabase, "inspections", "sort_order"),
    },
    {
      migration: "0023",
      label: "Several documents per checklist item",
      detail: "Two certificates against the same item, both carried into the approval.",
      probe: hasColumn(supabase, "checklist_item_files", "is_current"),
    },
    {
      migration: "0024",
      label: "Client document limit",
      detail: "Caps a client at two documents per item.",
      probe: hasFunction(supabase, "client_submit_document", {
        p_item_id: "00000000-0000-0000-0000-000000000000",
        p_file_path: "",
        p_document_no: null,
      }),
    },
    {
      migration: "0025",
      label: "Contract certifier letterhead",
      detail: "An outside certifier's inspections go out under their own company.",
      probe: hasColumn(supabase, "certifiers", "practice_name"),
    },
    {
      migration: "0026",
      label: "Cloud backup",
      detail: "Copies of a job's documents in the firm's own Dropbox or OneDrive.",
      probe: hasTable(supabase, "cloud_backup_connections"),
    },
    {
      migration: "0027",
      label: "Stored signed inspection reports",
      detail: "The signed report is built once, not rebuilt on every download.",
      probe: hasColumn(supabase, "inspections", "report_pdf_path"),
    },
    {
      migration: "0028",
      label: "Recoverable deletion",
      detail: "A deleted project can be brought back from Projects → Deleted.",
      probe: hasColumn(supabase, "jobs", "deleted_at"),
    },
    {
      migration: "0028",
      label: "Audit log",
      detail: "Records what happened, including things that were later undone.",
      probe: hasTable(supabase, "audit_events"),
    },
    {
      migration: "0028",
      label: "Rate limiting",
      detail: "Stops the public portal and the big downloads being hammered.",
      probe: hasFunction(supabase, "record_rate_limit_hit", { p_bucket: "system-check", p_window_seconds: 60, p_limit: 1000000 }),
    },
    {
      migration: "0029",
      label: "Saving one field without overwriting the rest",
      detail: "Two screens writing to the same project at once no longer lose each other's work.",
      probe: hasFunction(supabase, "merge_job_details", { p_job_id: "00000000-0000-0000-0000-000000000000", p_patch: {} }),
    },
    {
      migration: "0030",
      label: "Portal inspection case numbers",
      detail: "Keeps the Portal's own case number for each inspection reported through the API.",
      probe: hasColumn(supabase, "inspections", "portal_child_case_id"),
    },
    {
      migration: "0031",
      label: "Certifier Portal login emails",
      detail: "Each certifier's Planning Portal login, recorded once in Settings and offered on every report.",
      probe: hasColumn(supabase, "certifiers", "portal_email"),
    },
    {
      migration: "0032",
      label: "Company Portal account",
      detail: "The firm's own Planning Portal login, used for every report unless a certifier carries their own.",
      probe: hasColumn(supabase, "firms", "portal_email"),
    },
  ];

  const applied = await Promise.all(checks.map((c) => c.probe));
  return checks.map((c, i) => ({ migration: c.migration, label: c.label, detail: c.detail, applied: applied[i] }));
}

export type EnvCheck = { label: string; detail: string; configured: boolean };

// The other half of "why isn't this working": settings that live in
// Vercel rather than in the database. Only whether each is set — never
// the value.
export function runEnvChecks(): EnvCheck[] {
  return [
    {
      label: "Email delivery",
      detail: "Without this, clients are never emailed and nothing says so at the time.",
      configured: emailConfigured(),
    },
    {
      label: "Dropbox backup",
      detail: "Needed before a firm can connect its Dropbox.",
      configured: !!(process.env.DROPBOX_CLIENT_ID && process.env.DROPBOX_CLIENT_SECRET),
    },
    {
      label: "OneDrive backup",
      detail: "Needed before a firm can connect its OneDrive.",
      configured: !!(process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET),
    },
    {
      label: "NSW Planning Portal",
      detail: "Set once ePlanning finishes API onboarding — then inspections can be reported from CertFlow.",
      configured: portalConfigured(),
    },
    {
      label: "ePlanning inbound credentials",
      detail: "The Basic Auth details lodged with ePlanning so their gateway can download documents from CertFlow.",
      configured: !!(process.env.EPLANNING_INBOUND_USERNAME && process.env.EPLANNING_INBOUND_PASSWORD),
    },
  ];
}
