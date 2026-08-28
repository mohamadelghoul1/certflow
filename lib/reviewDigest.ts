import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyJobClient } from "@/lib/email";
import { quietWindowOpen, burstSettled } from "@/lib/uploadDigest";
import { escapeHtml } from "@/lib/html";

// Summary emails to the client about their documents being reviewed —
// approved, or changes requested. The mirror of lib/uploadDigest.ts,
// with the same rule: the first event of a burst emails straight away,
// the rest accumulate inside the quiet window and go as one summary,
// and the overnight sweep catches any burst tail. A certifier working
// through ten documents makes one or two emails, not ten.

export type ReviewEvent = { item_title: string | null; kind: "approved" | "changes"; note: string | null };


export function reviewEmail(events: ReviewEvent[], address: string | null): { subject: string; html: string } {
  const approved = events.filter((e) => e.kind === "approved");
  const changes = events.filter((e) => e.kind === "changes");
  const where = address ? ` — ${address}` : "";
  const subject =
    changes.length > 0
      ? `Changes requested on your documents${where}`
      : approved.length === 1
        ? `Document approved${where}`
        : `${approved.length} documents approved${where}`;

  const parts: string[] = [`<p>Your certifier has reviewed your documents${address ? ` for <strong>${escapeHtml(address)}</strong>` : ""}:</p>`];
  if (approved.length > 0) {
    parts.push(
      `<p style="margin-bottom:4px"><strong>Approved</strong></p><ul style="padding-left:18px">${approved
        .map((e) => `<li style="margin-bottom:2px">${escapeHtml(e.item_title || "a document")}</li>`)
        .join("")}</ul>`
    );
  }
  if (changes.length > 0) {
    parts.push(
      `<p style="margin-bottom:4px"><strong>Changes requested</strong></p><ul style="padding-left:18px">${changes
        .map((e) => `<li style="margin-bottom:2px">${escapeHtml(e.item_title || "a document")}${e.note ? ` &mdash; ${escapeHtml(e.note)}` : ""}</li>`)
        .join("")}</ul>`,
      `<p>Please upload the corrected documents through your portal.</p>`
    );
  }
  return { subject, html: parts.join("") };
}

// One summary for a job's unmentioned review events, quiet window
// allowing. Rows are only marked once the email actually went.
export async function flushJobReviews(
  admin: SupabaseClient,
  jobId: string,
  { requireSettled }: { requireSettled: boolean },
  now: Date = new Date()
): Promise<number> {
  const { data: pending } = await admin
    .from("review_events")
    .select("id, item_title, kind, note, created_at")
    .eq("job_id", jobId)
    .is("notified_at", null)
    .order("created_at");
  if (!pending || pending.length === 0) return 0;

  const { data: last } = await admin
    .from("review_events")
    .select("notified_at")
    .eq("job_id", jobId)
    .not("notified_at", "is", null)
    .order("notified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!quietWindowOpen(last?.notified_at ?? null, now)) return 0;
  if (requireSettled && !burstSettled(pending[pending.length - 1].created_at, now)) return 0;

  const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
  const { subject, html } = reviewEmail(pending as ReviewEvent[], job?.address ?? null);
  const outcome = await notifyJobClient(admin, jobId, subject, html);
  if (!outcome.sent) return 0;

  await admin
    .from("review_events")
    .update({ notified_at: now.toISOString() })
    .in(
      "id",
      pending.map((r) => r.id)
    );
  return pending.length;
}

// The sweep half, run from the daily cron.
export async function runReviewDigests(admin: SupabaseClient, now: Date = new Date()): Promise<{ jobs: number; events: number }> {
  const { data: rows } = await admin.from("review_events").select("job_id").is("notified_at", null);
  const jobIds = [...new Set((rows || []).map((r) => r.job_id as string))];
  let events = 0;
  let jobs = 0;
  for (const jobId of jobIds) {
    const sent = await flushJobReviews(admin, jobId, { requireSettled: true }, now);
    if (sent > 0) {
      jobs += 1;
      events += sent;
    }
  }
  return { jobs, events };
}

// Called from the approve / request-changes actions, after the response
// is on its way. If the events table isn't there (migration not run),
// the client is emailed directly instead — losing the batching is fine,
// losing the notification is not.
export async function recordReviewEvent(
  admin: SupabaseClient,
  { jobId, itemId, kind, note }: { jobId: string; itemId: string; kind: "approved" | "changes"; note: string | null }
): Promise<void> {
  const { data: item } = await admin.from("checklist_items").select("title").eq("id", itemId).single();
  const { error } = await admin.from("review_events").insert({ job_id: jobId, item_title: item?.title || null, kind, note });
  if (error) {
    const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
    const { subject, html } = reviewEmail([{ item_title: item?.title || null, kind, note }], job?.address ?? null);
    await notifyJobClient(admin, jobId, subject, html);
  } else {
    await flushJobReviews(admin, jobId, { requireSettled: false });
  }
}
