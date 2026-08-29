import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyJobClient } from "@/lib/email";
import { recordAuditEvent } from "@/lib/audit";
import { pathwayLabel, type Pathway } from "@/lib/business";
import { escapeHtml } from "@/lib/html";

// Writing the "still waiting on your documents" email so nobody has to.
//
// The checklists already hold the answer — which documents were asked
// for, which arrived, which came back needing changes — so the reminder
// is assembled from them rather than written. The rules around it are
// deliberately conservative: a client is only ever emailed when they
// genuinely owe something, never more than once per interval, and any
// contact from the certifier (a manual status update) restarts the
// clock, so nobody is chased three days after being spoken to.

export type ReminderItem = {
  title: string;
  // An unresolved amendment means the document arrived but has to be
  // fixed — a different sentence to the client than "not received".
  needsChanges: boolean;
};

export type ReminderSection = { label: string; items: ReminderItem[] };

type ItemRow = { title: string; status: string; internal?: boolean | null; amendments?: { resolved: boolean }[] | null };
type ChecklistRow = { kind: string; checklist_items?: ItemRow[] | null };

function sectionLabel(kind: string, pathway: Pathway): string {
  if (kind === "pathway") return `${pathwayLabel(pathway)} application documents`;
  if (kind === "noc") return "Notice of Commencement";
  if (kind === "oc") return "Occupation Certificate";
  return "Modification";
}

// What the client still owes, checklist by checklist. A document counts
// when it was requested and never arrived, or when it arrived and came
// back with unresolved amendments. One that is sitting with the
// certifier for review is the certifier's to deal with, not the
// client's, and chasing it would be chasing someone for work already
// done.
export function outstandingSections(checklists: ChecklistRow[], pathway: Pathway): ReminderSection[] {
  const sections: ReminderSection[] = [];
  for (const checklist of checklists) {
    const items: ReminderItem[] = [];
    for (const item of checklist.checklist_items || []) {
      // An internal item is the firm's own step. Chasing a client for
      // something they cannot see is the worst kind of reminder.
      if (item.internal) continue;
      const needsChanges = (item.amendments || []).some((a) => !a.resolved);
      if (needsChanges) items.push({ title: item.title, needsChanges: true });
      else if (item.status === "requested") items.push({ title: item.title, needsChanges: false });
    }
    if (items.length > 0) sections.push({ label: sectionLabel(checklist.kind, pathway), items });
  }
  return sections;
}

export function outstandingCount(sections: ReminderSection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}

// Whether it is time to remind this job's client. The clock starts from
// the most recent contact of any kind — the last automatic reminder, the
// last manual notification, or the job's creation — so a client is never
// chased inside the quiet period, whichever way they were last spoken to.
export function reminderDue(
  opts: { createdAt: string | null; lastReminderAt?: string | null; lastNotifiedAt?: string | null; everyDays: number },
  now: Date
): boolean {
  const times = [opts.createdAt, opts.lastReminderAt, opts.lastNotifiedAt]
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return true;
  const lastContact = Math.max(...times);
  return now.getTime() - lastContact >= opts.everyDays * 24 * 60 * 60 * 1000;
}

export function reminderEmailHtml(sections: ReminderSection[]): string {
  const parts: string[] = [
    `<p>Just a friendly reminder — the following ${outstandingCount(sections) === 1 ? "document is" : "documents are"} still needed so your project can keep moving:</p>`,
  ];
  for (const section of sections) {
    parts.push(`<p style="margin-bottom:4px"><strong>${escapeHtml(section.label)}</strong></p>`);
    const lines = section.items.map(
      (item) =>
        `<li style="margin-bottom:2px">${escapeHtml(item.title)}${item.needsChanges ? ' <span style="color:#b45309">&mdash; needs changes, see the note in your portal</span>' : ""}</li>`
    );
    parts.push(`<ul style="margin-top:0">${lines.join("")}</ul>`);
  }
  parts.push(`<p>You can upload them straight into your portal, and we&rsquo;ll take it from there.</p>`);
  return parts.join("");
}


type FirmSettings = { enabled: boolean; everyDays: number };

// True when the database rejected a query because migration 0033 hasn't
// been run — the reminder system then reports itself as not ready
// instead of erroring every morning.
function isMissingColumn(error: { code?: string | null } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST100";
}

export type ReminderRunSummary = {
  ready: boolean;
  jobsConsidered: number;
  remindersSent: number;
  notes: string[];
};

// The daily sweep. Runs under the service role because there is no
// signed-in certifier at 7am — but it only ever reads what the
// checklists already say and sends the email each firm has switched on.
export async function runDocumentReminders(admin: SupabaseClient, now: Date = new Date()): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = { ready: true, jobsConsidered: 0, remindersSent: 0, notes: [] };

  const { data: firms, error: firmsError } = await admin.from("firms").select("id, document_reminders_enabled, document_reminder_days");
  if (firmsError) {
    summary.ready = !isMissingColumn(firmsError);
    summary.notes.push(summary.ready ? `firms: ${firmsError.message}` : "migration 0033 has not been run yet");
    return summary;
  }

  const firmSettings = new Map<string, FirmSettings>(
    (firms || []).map((f) => [
      f.id as string,
      { enabled: f.document_reminders_enabled !== false, everyDays: Number(f.document_reminder_days) || 7 },
    ])
  );

  const { data: jobs, error: jobsError } = await admin
    .from("jobs")
    .select(
      "id, firm_id, address, pathway, client_id, created_at, last_notified_at, last_document_reminder_at, checklists(kind, checklist_items(*, amendments(resolved)))"
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("document_reminders_paused", false)
    .not("client_id", "is", null);
  if (jobsError) {
    summary.ready = !isMissingColumn(jobsError);
    summary.notes.push(summary.ready ? `jobs: ${jobsError.message}` : "migration 0033 has not been run yet");
    return summary;
  }

  for (const job of jobs || []) {
    const settings = firmSettings.get(job.firm_id as string);
    if (!settings?.enabled) continue;
    summary.jobsConsidered++;

    const sections = outstandingSections((job.checklists as ChecklistRow[]) || [], job.pathway as Pathway);
    if (sections.length === 0) continue;
    if (!reminderDue({ createdAt: job.created_at, lastReminderAt: job.last_document_reminder_at, lastNotifiedAt: job.last_notified_at, everyDays: settings.everyDays }, now)) continue;

    const count = outstandingCount(sections);
    await notifyJobClient(admin, job.id, `Documents outstanding — ${job.address}`, reminderEmailHtml(sections));
    // The timestamp moves even when the send fails: the failure is
    // already on the Audit page, and retrying every morning would turn
    // one bad address into a daily error instead of a weekly one.
    await admin.from("jobs").update({ last_document_reminder_at: now.toISOString() }).eq("id", job.id);
    await recordAuditEvent(admin, {
      firmId: job.firm_id,
      action: "client.reminder",
      summary: `Reminded the client: ${count} document${count === 1 ? "" : "s"} outstanding`,
      jobId: job.id,
      jobAddress: job.address,
      detail: { outstanding: count },
    });
    summary.remindersSent++;
  }

  return summary;
}
