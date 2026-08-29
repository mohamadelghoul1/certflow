import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/audit";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Who an email comes from, and where a reply to it lands.
//
// A firm sends from an address nobody reads — notifications@, no-reply@ —
// and wants answers at the one they do. Without a reply-to, a client
// pressing Reply writes to the sending address, and if nobody watches
// that mailbox their answer is simply lost.
//
// Read when an email is sent rather than when this file is loaded, so
// what the System check reports is what the next email will actually
// carry.
const FALLBACK_FROM = "CertFlow <onboarding@resend.dev>";

export function emailSenderSettings() {
  const configured = (process.env.RESEND_FROM_EMAIL || "").trim();
  const replyTo = (process.env.RESEND_REPLY_TO || "").trim();
  return {
    from: configured || FALLBACK_FROM,
    replyTo: replyTo || null,
    // Nothing has been set, so mail goes out from Resend's own address —
    // which looks like nobody and lands in spam.
    usingFallbackSender: !configured,
  };
}
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

// A file to travel with the email. The invoice PDF is the one that
// matters: a client should be able to file the invoice from their inbox
// without logging in to anything.
export type EmailAttachment = { filename: string; content: Buffer };

// Sending can fail two different ways and only one of them throws: a
// network problem raises, but a rejected key, an unverified sending
// domain or a bad address comes back as an ordinary response with an
// error on it. That second kind used to pass straight through this
// function as a success, which is how an email nobody received could
// look exactly like one that arrived.
export async function sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]): Promise<SendResult> {
  if (!resend) return { sent: false, skipped: "not-configured" };
  try {
    const { from, replyTo } = emailSenderSettings();
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      // The SDK's own name for it; it sends the API's reply_to.
      ...(replyTo ? { replyTo } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
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

// What actually happened to a notification — so a button pressed by a
// person can say so, instead of only the audit log knowing.
export type NotifyOutcome = { sent: boolean; reason?: string };

// Emails the client attached to a job, if there is one and they have an
// email on file. Used from server actions right after a mutation that
// should notify the client (document approved, amendment raised,
// certificate/report released).
export async function notifyJobClient(
  supabase: SupabaseClient,
  jobId: string,
  subject: string,
  bodyHtml: string,
  // Anything that should travel with the message — an inspection report,
  // so the client does not have to log in to learn whether their slab
  // passed.
  attachments?: EmailAttachment[]
): Promise<NotifyOutcome> {
  const { data: job } = await supabase.from("jobs").select("firm_id, address, client_id").eq("id", jobId).single();
  if (!job?.client_id) return { sent: false, reason: "This project has no client attached — add one on the Details tab." };
  const { data: client } = await supabase.from("clients").select("name, email").eq("id", job.client_id).single();

  if (!client?.email) {
    await recordEmailFailure(supabase, jobId, {
      firmId: job.firm_id,
      jobAddress: job.address,
      recipient: client?.name || "the client",
      subject,
      reason: "no email address on file",
    });
    return { sent: false, reason: "The client has no email address on file." };
  }

  const result = await sendEmail(
    client.email,
    subject,
    `<p>Hi ${client.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to your CertFlow portal to view the details: <a href="${SITE_URL}/client-login">${SITE_URL}/client-login</a></p>`,
    attachments
  );

  if (result.error) {
    await recordEmailFailure(supabase, jobId, { firmId: job.firm_id, jobAddress: job.address, recipient: client.email, subject, reason: result.error });
    return { sent: false, reason: `The email could not be sent: ${result.error}` };
  }
  if (result.skipped) return { sent: false, reason: "Email isn't switched on for this deployment yet." };
  return { sent: true };
}

// Emails the certifier assigned to a job — the events that flow the
// other direction: a client booking an inspection, a client sending
// documents in. The address is found by trying everything the firm has
// told us: the certifier's login email, then their Portal or practice
// email, then the firm's own address. Every way this can fail to send
// is written to the audit log — an early return that nobody hears about
// is how these notifications went missing for days.
export async function notifyJobCertifier(supabase: SupabaseClient, jobId: string, subject: string, bodyHtml: string): Promise<NotifyOutcome> {
  const { data: job } = await supabase.from("jobs").select("firm_id, address, assigned_certifier_id").eq("id", jobId).single();
  if (!job) return { sent: false, reason: "Project not found." };

  const fail = async (recipient: string, reason: string): Promise<NotifyOutcome> => {
    await recordEmailFailure(supabase, jobId, { firmId: job.firm_id, jobAddress: job.address, recipient, subject, reason });
    return { sent: false, reason };
  };

  if (!job.assigned_certifier_id) return fail("the assigned certifier", "the project has no assigned certifier (Details tab)");

  // select("*") on purpose: naming the email column would fail the whole
  // lookup on a database that hasn't run migration 0040 yet.
  const { data: certifier } = await supabase.from("certifiers").select("*").eq("id", job.assigned_certifier_id).single();
  const { data: profile } = certifier?.user_id ? await supabase.from("profiles").select("email").eq("id", certifier.user_id).single() : { data: null };
  // Their own stated notification address wins; the login and the other
  // recorded addresses are the fallbacks.
  let email = certifier?.email || profile?.email || certifier?.portal_email || certifier?.practice_email || null;
  if (!email) {
    const { data: firm } = await supabase.from("firms").select("email").eq("id", job.firm_id).single();
    email = firm?.email || null;
  }
  if (!email) return fail(certifier?.name || "the assigned certifier", "no email address on file for the assigned certifier or the firm");

  const result = await sendEmail(
    email,
    subject,
    `<p>Hi ${certifier?.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to CertFlow to view the details: <a href="${SITE_URL}/login">${SITE_URL}/login</a></p>`
  );

  if (result.error) return fail(email, result.error);
  if (result.skipped) return { sent: false, reason: "Email isn't switched on for this deployment yet." };
  return { sent: true };
}
