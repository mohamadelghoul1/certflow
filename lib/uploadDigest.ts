import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyJobCertifier } from "@/lib/email";

// Summary emails for documents clients send in from the portal.
//
// One email per upload turned noisy the moment a client sent five
// documents in a row, so uploads are written to portal_uploads and
// mentioned in batches instead. The rule: at most one email per job per
// quiet window. The first upload of a burst goes out straight away —
// the certifier hears promptly — and everything that lands inside the
// window accumulates silently, to be sent as one summary by whatever
// comes next: a later upload, or the overnight sweep. Every row is
// mentioned in exactly one email; none are dropped.

export const UPLOAD_QUIET_MINUTES = 15;

const quietMs = UPLOAD_QUIET_MINUTES * 60_000;

// Whether enough silence has passed since the last email about this job
// that another one is welcome.
export function quietWindowOpen(lastNotifiedAt: string | null, now: Date = new Date()): boolean {
  if (!lastNotifiedAt) return true;
  return now.getTime() - new Date(lastNotifiedAt).getTime() >= quietMs;
}

// Whether a burst of uploads looks finished — nothing new for a full
// window. The overnight sweep waits for this so it doesn't email
// mid-burst and split one delivery into two.
export function burstSettled(newestUploadedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(newestUploadedAt).getTime() >= quietMs;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type UploadMention = { item_title: string | null; file_name: string | null };

export function digestEmail(uploads: UploadMention[], address: string | null): { subject: string; html: string } {
  const n = uploads.length;
  const where = address ? ` — ${address}` : "";
  const subject = n === 1 ? `New document from your client${where}` : `${n} new documents from your client${where}`;
  const list = uploads
    .map(
      (u) =>
        `<li style="margin-bottom:2px"><strong>${escapeHtml(u.file_name || "a document")}</strong>${
          u.item_title ? ` — ${escapeHtml(u.item_title)}` : ""
        }</li>`
    )
    .join("");
  const html = [
    `<p>Your client has uploaded ${n === 1 ? "a document" : `${n} documents`}${address ? ` on <strong>${escapeHtml(address)}</strong>` : ""}:</p>`,
    `<ul style="padding-left:18px">${list}</ul>`,
    `<p>${n === 1 ? "It's" : "They're"} ready for your review.</p>`,
  ].join("");
  return { subject, html };
}

// Sends one summary for a job's unmentioned uploads, if the quiet window
// allows it. `requireSettled` is the sweep's politeness: don't email in
// the middle of a burst. Returns how many uploads were mentioned.
export async function flushJobUploads(
  admin: SupabaseClient,
  jobId: string,
  { requireSettled }: { requireSettled: boolean },
  now: Date = new Date()
): Promise<number> {
  const { data: pending } = await admin
    .from("portal_uploads")
    .select("id, item_title, file_name, uploaded_at")
    .eq("job_id", jobId)
    .is("notified_at", null)
    .order("uploaded_at");
  if (!pending || pending.length === 0) return 0;

  const { data: last } = await admin
    .from("portal_uploads")
    .select("notified_at")
    .eq("job_id", jobId)
    .not("notified_at", "is", null)
    .order("notified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!quietWindowOpen(last?.notified_at ?? null, now)) return 0;
  if (requireSettled && !burstSettled(pending[pending.length - 1].uploaded_at, now)) return 0;

  const { data: job } = await admin.from("jobs").select("address").eq("id", jobId).single();
  const { subject, html } = digestEmail(pending, job?.address ?? null);
  const outcome = await notifyJobCertifier(admin, jobId, subject, html);

  // Rows are only marked once the email actually went. Marking them on a
  // failed send — no assigned certifier yet, say — both lost those
  // uploads for good and shut the quiet window on the next quarter hour
  // of uploads for nothing. Unsent rows stay pending and go with the
  // next attempt; the failure itself is on the audit log.
  if (!outcome.sent) return 0;

  await admin
    .from("portal_uploads")
    .update({ notified_at: now.toISOString() })
    .in(
      "id",
      pending.map((r) => r.id)
    );
  return pending.length;
}

// The sweep half, run from the daily cron: catches the tail of any burst
// that never saw another upload to flush it.
export async function runUploadDigests(admin: SupabaseClient, now: Date = new Date()): Promise<{ jobs: number; uploads: number }> {
  const { data: rows } = await admin.from("portal_uploads").select("job_id").is("notified_at", null);
  const jobIds = [...new Set((rows || []).map((r) => r.job_id as string))];
  let uploads = 0;
  let jobs = 0;
  for (const jobId of jobIds) {
    const sent = await flushJobUploads(admin, jobId, { requireSettled: true }, now);
    if (sent > 0) {
      jobs += 1;
      uploads += sent;
    }
  }
  return { jobs, uploads };
}
