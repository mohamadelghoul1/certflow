import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/audit";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "CertFlow <onboarding@resend.dev>";
// Falls back to the production URL Vercel supplies, so a missing or
// stale setting cannot mail out a localhost link. See lib/siteUrl.ts —
// emails are sent from scheduled runs too, where no request exists.
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes("localhost") ? process.env.NEXT_PUBLIC_SITE_URL : "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "http://localhost:3000";

// Whether email is switched on at all. The rest of the app uses this to
// say so plainly rather than letting a certifier believe a client was
// notified when nothing was ever sent.
export function emailConfigured(): boolean {
  return !!resend;
}

export type SendResult = { sent: boolean; skipped?: "not-configured"; error?: string };

// Sending can fail two different ways and only one of them throws: a
// network problem raises, but a rejected key, an unverified sending
// domain or a bad address comes back as an ordinary response with an
// error on it. That second kind used to pass straight through this
// function as a success, which is how an email nobody received could
// look exactly like one that arrived.
export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!resend) return { sent: false, skipped: "not-configured" };
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { sent: false, error: error.message || String(error) };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// A notification that did not go out is worth more than a note in a
// server log nobody reads: the certifier believes the client has been
// told. Failures — and clients with no address on file — are written to
// the audit log, where they show up on the Audit page.
async function recordEmailFailure(
  supabase: SupabaseClient,
  jobId: string,
  detail: { firmId: string | null; jobAddress: string | null; recipient: string; subject: string; reason: string }
) {
  if (!detail.firmId) return;
  await recordAuditEvent(supabase, {
    firmId: detail.firmId,
    action: "email.failed",
    summary: `Could not email ${detail.recipient}: ${detail.reason}`,
    jobId,
    jobAddress: detail.jobAddress,
    detail: { subject: detail.subject, reason: detail.reason },
    severity: "error",
  });
}

// Emails the client attached to a job, if there is one and they have an
// email on file. Used from server actions right after a mutation that
// should notify the client (document approved, amendment raised,
// certificate/report released).
export async function notifyJobClient(supabase: SupabaseClient, jobId: string, subject: string, bodyHtml: string) {
  const { data: job } = await supabase.from("jobs").select("firm_id, address, client_id").eq("id", jobId).single();
  if (!job?.client_id) return;
  const { data: client } = await supabase.from("clients").select("name, email").eq("id", job.client_id).single();

  if (!client?.email) {
    await recordEmailFailure(supabase, jobId, {
      firmId: job.firm_id,
      jobAddress: job.address,
      recipient: client?.name || "the client",
      subject,
      reason: "no email address on file",
    });
    return;
  }

  const result = await sendEmail(
    client.email,
    subject,
    `<p>Hi ${client.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to your CertFlow portal to view the details: <a href="${SITE_URL}/client-login">${SITE_URL}/client-login</a></p>`
  );

  if (result.error) {
    await recordEmailFailure(supabase, jobId, { firmId: job.firm_id, jobAddress: job.address, recipient: client.email, subject, reason: result.error });
  }
}

// Emails the certifier assigned to a job — used for the one event that
// flows the other direction: a client booking an inspection themselves.
export async function notifyJobCertifier(supabase: SupabaseClient, jobId: string, subject: string, bodyHtml: string) {
  const { data: job } = await supabase.from("jobs").select("firm_id, address, assigned_certifier_id").eq("id", jobId).single();
  if (!job?.assigned_certifier_id) return;
  const { data: certifier } = await supabase.from("certifiers").select("name, user_id").eq("id", job.assigned_certifier_id).single();
  if (!certifier?.user_id) return;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", certifier.user_id).single();

  if (!profile?.email) {
    await recordEmailFailure(supabase, jobId, {
      firmId: job.firm_id,
      jobAddress: job.address,
      recipient: certifier.name || "the assigned certifier",
      subject,
      reason: "no email address on file",
    });
    return;
  }

  const result = await sendEmail(
    profile.email,
    subject,
    `<p>Hi ${certifier.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to CertFlow to view the details: <a href="${SITE_URL}/login">${SITE_URL}/login</a></p>`
  );

  if (result.error) {
    await recordEmailFailure(supabase, jobId, { firmId: job.firm_id, jobAddress: job.address, recipient: profile.email, subject, reason: result.error });
  }
}
