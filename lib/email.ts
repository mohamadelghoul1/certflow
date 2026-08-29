import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/audit";
import { siteUrl } from "@/lib/siteUrl";

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
const FALLBACK_FROM = "Certlyn <onboarding@resend.dev>";

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
// Where the links in these emails point.
//
// Asked of the request the email is being sent from, so moving the site
// to its own domain needs nothing changed here: the next notification a
// certifier triggers already carries the address they are looking at.
// Only a scheduled run has no request, and there siteUrl falls back to
// the configured address, then to the production URL Vercel supplies —
// so a missing or stale setting still cannot mail out a localhost link.
//
// It used to be read once when this file was loaded, which meant a
// changed address took a redeploy to take effect and, until then, mailed
// out the old one with nothing to say so.

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
export type EmailSender = {
  from: string;
  replyTo: string | null;
  // The Resend account the message actually leaves through. Null means
  // the deployment's own.
  apiKey: string | null;
  // True when this firm sends through its own Resend account rather
  // than the deployment's.
  ownAccount: boolean;
};

// The service-role client, which is the only thing that can read a
// firm's Resend key: migration 0060 gives that table no read policy at
// all. Null when the service key is not configured — in tests, and in
// any environment where it is genuinely absent — in which case a firm
// simply falls back to the deployment's account, as it did before.
function adminOrNull(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

// The Resend account this firm sends through.
export async function firmEmailCredentials(admin: SupabaseClient | null, firmId: string): Promise<{ apiKey: string | null; ownAccount: boolean }> {
  if (!admin) return { apiKey: null, ownAccount: false };
  try {
    const { data } = await admin.from("firm_email_credentials").select("*").eq("firm_id", firmId).maybeSingle();
    const key = ((data as { resend_api_key?: string | null } | null)?.resend_api_key || "").trim();
    if (key) return { apiKey: key, ownAccount: true };
  } catch {
    // Migration 0060 has not been run. Falls through to the
    // deployment's account, which is how it worked before.
  }
  return { apiKey: null, ownAccount: false };
}

// What Settings is allowed to know about the firm's Resend account:
// whether a key is set, and when it last changed. Asked with the
// certifier's own session — the function behind it returns booleans, so
// nothing that reaches a browser could carry a key.
export type FirmEmailStatus = {
  apiKeySet: boolean;
  updatedAt: string | null;
  // False until migration 0060 has been run against this database.
  installed: boolean;
};

export async function firmEmailStatus(supabase: SupabaseClient): Promise<FirmEmailStatus> {
  const { data, error } = await supabase.rpc("firm_email_status");
  if (error) return { apiKeySet: false, updatedAt: null, installed: false };
  const row = (data as { api_key_set?: boolean; updated_at?: string }[] | null)?.[0];
  return { apiKeySet: row?.api_key_set === true, updatedAt: row?.updated_at || null, installed: true };
}

// Whether this firm can send email at all — through its own Resend
// account, or the deployment's. Used by the buttons that would otherwise
// tell a firm on its own account that "email isn't switched on".
export async function firmEmailConfigured(supabase: SupabaseClient): Promise<boolean> {
  if (emailConfigured()) return true;
  return (await firmEmailStatus(supabase)).apiKeySet;
}

// Which firm the email is from, looked up once.
//
// The sending address used to be one setting for the whole deployment,
// which is right for one firm and wrong the moment there are two: a
// second firm's clients would receive their certificates apparently from
// the first firm, and every reply would land in the first firm's inbox.
//
// Two settings, and they must not be mixed. Resend will only send from a
// domain verified in the account whose key is used, so a firm on its own
// Resend account can only send as itself — being handed the deployment's
// address there would not merely look wrong, it would be rejected. So a
// firm with its own account never inherits the deployment's address or
// its reply-to; it sends as itself or it does not send, and the failure
// says which.
//
// A firm with neither set behaves exactly as before.
export async function firmSender(supabase: SupabaseClient, firmId: string, admin?: SupabaseClient | null): Promise<EmailSender> {
  const fallback = emailSenderSettings();
  const account = await firmEmailCredentials(admin === undefined ? adminOrNull() : admin, firmId);
  try {
    // select("*") on purpose: naming the columns would fail the whole
    // lookup on a database that has not run migration 0058, and an
    // email that does not send is worse than one from the wrong name.
    const { data } = await supabase.from("firms").select("*").eq("id", firmId).maybeSingle();
    const firm = data as { from_email?: string | null; reply_to_email?: string | null } | null;
    const from = (firm?.from_email || "").trim();
    const replyTo = (firm?.reply_to_email || "").trim();
    const ownName = !!from || account.ownAccount;
    return {
      from: from || (account.ownAccount ? "" : fallback.from),
      replyTo: replyTo || (ownName ? null : fallback.replyTo),
      apiKey: account.apiKey,
      ownAccount: account.ownAccount,
    };
  } catch {
    return {
      from: account.ownAccount ? "" : fallback.from,
      replyTo: account.ownAccount ? null : fallback.replyTo,
      apiKey: account.apiKey,
      ownAccount: account.ownAccount,
    };
  }
}

export async function sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[], sender?: EmailSender): Promise<SendResult> {
  const { from, replyTo, apiKey } = sender ?? { ...emailSenderSettings(), apiKey: null, ownAccount: false };
  // The firm's own Resend account when it has one, this deployment's
  // otherwise.
  const client = apiKey ? new Resend(apiKey) : resend;
  if (!client) return { sent: false, skipped: "not-configured" };
  // A firm on its own Resend account with no sending address of its own.
  // Nothing sensible can be sent: the deployment's address would be
  // rejected by their account as an unverified domain, and sending it
  // anyway is exactly what having their own account is meant to prevent.
  if (!from) {
    return { sent: false, error: "No sending address set for this firm — Settings → Email sending." };
  }
  try {
    const { error } = await client.emails.send({
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

  const site = await siteUrl();
  const result = await sendEmail(
    client.email,
    subject,
    `<p>Hi ${client.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to your Certlyn portal to view the details: <a href="${site}/client-login">${site}/client-login</a></p>`,
    attachments,
    await firmSender(supabase, job.firm_id)
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

  const site = await siteUrl();
  const result = await sendEmail(
    email,
    subject,
    `<p>Hi ${certifier?.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to Certlyn to view the details: <a href="${site}/login">${site}/login</a></p>`,
    undefined,
    await firmSender(supabase, job.firm_id)
  );

  if (result.error) return fail(email, result.error);
  if (result.skipped) return { sent: false, reason: "Email isn't switched on for this deployment yet." };
  return { sent: true };
}
