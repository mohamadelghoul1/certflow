import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || "CertFlow <onboarding@resend.dev>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// If no API key is configured yet, every call below is a silent no-op —
// this is a Phase 2 feature (build brief §10), safe to leave off until a
// Resend account exists.
export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

// Emails the client attached to a job, if there is one and they have an
// email on file. Used from server actions right after a mutation that
// should notify the client (document approved, amendment raised,
// certificate/report released).
export async function notifyJobClient(supabase: SupabaseClient, jobId: string, subject: string, bodyHtml: string) {
  const { data: job } = await supabase.from("jobs").select("address, client_id").eq("id", jobId).single();
  if (!job?.client_id) return;
  const { data: client } = await supabase.from("clients").select("name, email").eq("id", job.client_id).single();
  if (!client?.email) return;

  await sendEmail(
    client.email,
    subject,
    `<p>Hi ${client.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to your CertFlow portal to view the details: <a href="${SITE_URL}/client-login">${SITE_URL}/client-login</a></p>`
  );
}

// Emails the certifier assigned to a job — used for the one event that
// flows the other direction: a client booking an inspection themselves.
export async function notifyJobCertifier(supabase: SupabaseClient, jobId: string, subject: string, bodyHtml: string) {
  const { data: job } = await supabase.from("jobs").select("address, assigned_certifier_id").eq("id", jobId).single();
  if (!job?.assigned_certifier_id) return;
  const { data: certifier } = await supabase.from("certifiers").select("name, user_id").eq("id", job.assigned_certifier_id).single();
  if (!certifier?.user_id) return;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", certifier.user_id).single();
  if (!profile?.email) return;

  await sendEmail(
    profile.email,
    subject,
    `<p>Hi ${certifier.name || "there"},</p>${bodyHtml}<p style="margin-top:24px">Log in to CertFlow to view the details: <a href="${SITE_URL}/login">${SITE_URL}/login</a></p>`
  );
}
