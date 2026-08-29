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

// Whether the booking rules have been brought up to date. These
// migrations change no table or column — only the answer the function
// gives — so each is asked a moment whose answer only the new rule
// produces.
async function bookingAnswer(supabase: SupabaseClient, at: string, expected: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("earliest_bookable_inspection_date", { p_now: at });
  if (error) return false;
  return String(data).slice(0, 10) === expected;
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
    {
      migration: "0033",
      label: "Automatic document reminders",
      detail: "Clients who still owe documents are chased by email, on a schedule set in Settings.",
      probe: hasColumn(supabase, "jobs", "last_document_reminder_at"),
    },
    {
      migration: "0034",
      label: "Invoicing",
      detail: "Tax invoices from quotes and projects, with what's owed on the dashboard.",
      probe: hasTable(supabase, "invoices"),
    },
    {
      migration: "0035",
      label: "Invoice payment details",
      detail: "The firm's bank details on every invoice, and card-payment links through Stripe.",
      probe: hasColumn(supabase, "invoices", "payment_details"),
    },
    {
      migration: "0036",
      label: "Card surcharge",
      detail: "The optional card-processing surcharge on invoices (auto-off from 1 October 2026).",
      probe: hasColumn(supabase, "invoices", "card_surcharge"),
    },
    {
      migration: "0037",
      label: "Builders list",
      detail: "Saved principal contractors, picked on any project instead of retyped.",
      probe: hasTable(supabase, "contractors"),
    },
    {
      migration: "0038",
      label: "Overdue invoice reminders",
      detail: "Clients with overdue invoices are chased by email, on the schedule set in Payment details.",
      probe: hasColumn(supabase, "invoices", "last_payment_reminder_at"),
    },
    {
      migration: "0039",
      label: "Client upload alerts",
      detail: "Emails you when a client sends a document in, batching a burst into one summary.",
      probe: hasTable(supabase, "portal_uploads"),
    },
    {
      migration: "0040",
      label: "Certifier notification email",
      detail: "Where each certifier's own alerts are sent, set in Settings → Certifiers.",
      probe: hasColumn(supabase, "certifiers", "email"),
    },
    {
      migration: "0041",
      label: "Review alerts to clients",
      detail: "Emails the client when their documents are approved or need changes.",
      probe: hasTable(supabase, "review_events"),
    },
    {
      migration: "0043",
      label: "Storage report",
      detail: "Shows what each project is holding, in Settings → Storage.",
      probe: hasFunction(supabase, "firm_storage_usage", {}),
    },
    {
      migration: "0047",
      label: "Fault log",
      detail: "Records anything that breaks and emails you the first time, on Audit → Faults.",
      probe: hasTable(supabase, "error_events"),
    },
    {
      migration: "0048",
      label: "Inspection booking waits for the NOC",
      detail: "Stops a client booking an inspection until the Notice of Commencement checklist is complete.",
      // The rule itself sits inside a function that has existed since the
      // beginning, so what is probed is the helper this migration adds
      // alongside it — the one thing that is only there once it has run.
      probe: hasFunction(supabase, "noc_checklist_outstanding", { p_job_id: null }),
    },
    {
      migration: "0049",
      label: "Inspection notice period",
      detail: "Before 1pm books tomorrow, after 1pm the day after, and Friday or the weekend books the Tuesday.",
      // A Friday 9am enquiry. Under the old rule it came back as the
      // Monday; under this one it is the Tuesday.
      probe: bookingAnswer(supabase, "2026-08-28T09:00:00+10:00", "2026-09-01"),
    },
    {
      migration: "0050",
      label: "Thursday afternoon books the Monday",
      detail: "A request after 1pm on a Thursday is booked for the Monday rather than the Tuesday. Replaces 0049.",
      probe: bookingAnswer(supabase, "2026-08-27T14:00:00+10:00", "2026-08-31"),
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
      label: "Card payments",
      detail: "Stripe, for the Pay-online button on invoices. Both the secret key and the webhook secret are needed.",
      configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
    {
      label: "Reminder schedule",
      detail: "Lets Vercel run the morning document-reminder sweep. Without it, only the manual Send reminder button works.",
      configured: !!process.env.CRON_SECRET,
    },
    {
      label: "ePlanning inbound credentials",
      detail: "The Basic Auth details lodged with ePlanning so their gateway can download documents from CertFlow.",
      configured: !!(process.env.EPLANNING_INBOUND_USERNAME && process.env.EPLANNING_INBOUND_PASSWORD),
    },
  ];
}

// Whether the alerts CertFlow sends have somewhere to go.
//
// A notification with no recipient is the quietest possible failure: the
// upload succeeds, the client sees no error, and the certifier simply
// never hears. These name the two things that silently break it — a
// project with nobody assigned, and a certifier with no address on file
// — while there is still time to fix them.
export type NotificationCheck = { label: string; detail: string; ok: boolean };

export async function runNotificationChecks(supabase: SupabaseClient, firmId: string): Promise<NotificationCheck[]> {
  const [{ data: jobs }, { data: certifiers }, { data: firm }] = await Promise.all([
    supabase.from("jobs").select("id, assigned_certifier_id, deleted_at").eq("firm_id", firmId),
    supabase.from("certifiers").select("*").eq("firm_id", firmId),
    supabase.from("firms").select("email").eq("id", firmId).single(),
  ]);

  const live = (jobs || []).filter((j) => !j.deleted_at);
  const unassigned = live.filter((j) => !j.assigned_certifier_id).length;

  // The same order notifyJobCertifier tries, minus the login address,
  // which isn't readable from here.
  const withoutEmail = (certifiers || []).filter(
    (c) => !((c as { email?: string | null }).email || c.portal_email || (c as { practice_email?: string | null }).practice_email)
  );

  return [
    {
      label: "Every project has a certifier assigned",
      detail:
        unassigned === 0
          ? "Client uploads and inspection bookings have someone to notify on all projects."
          : `${unassigned} project${unassigned === 1 ? " has" : "s have"} nobody assigned — nothing on ${unassigned === 1 ? "it" : "them"} can notify anyone. Set it on the project's Details tab.`,
      ok: unassigned === 0,
    },
    {
      label: "Every certifier has an email address",
      detail:
        withoutEmail.length === 0
          ? "Alerts reach each certifier directly."
          : `${withoutEmail.map((c) => c.name).join(", ")} has no address in Settings → Certifiers${firm?.email ? ", so their alerts fall back to the firm's address" : " and the firm has no address either, so their alerts go nowhere"}.`,
      ok: withoutEmail.length === 0 || !!firm?.email,
    },
  ];
}
