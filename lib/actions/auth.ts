"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { withinLimit, loginBucket, LOGIN_LIMIT } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";

const TOO_MANY = "Too many sign-in attempts for this email address. Wait a minute and try again.";

export type ActionState = { error?: string } | undefined;

export async function signInCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  if (!(await withinLimit(supabase, loginBucket(email), LOGIN_LIMIT))) return { error: TOO_MANY };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (!profile || profile.role !== "certifier") {
    await supabase.auth.signOut();
    return { error: "This login isn't set up as a certifier account." };
  }
  redirect("/dashboard");
}

export async function signInClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  if (!(await withinLimit(supabase, loginBucket(email), LOGIN_LIMIT))) return { error: TOO_MANY };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (!profile || profile.role !== "client") {
    await supabase.auth.signOut();
    return { error: "This login isn't set up as a client account." };
  }
  redirect("/portal");
}

export type ResetState = { error?: string; success?: string } | undefined;

// "I've forgotten my password" — for clients and certifiers alike.
//
// The link is minted here and sent through the firm's own email service,
// like every other CertFlow email, rather than Supabase's capped mailer.
// The reply never says whether the address is known: telling a stranger
// which emails hold accounts is how account lists leak.
export async function sendPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") || "").trim();
  const kind = String(formData.get("kind") || "client") === "certifier" ? "certifier" : "client";
  if (!email) return { error: "Enter your email address first." };

  const supabase = await createClient();
  if (!(await withinLimit(supabase, loginBucket(`reset:${email}`), LOGIN_LIMIT))) return { error: TOO_MANY };

  const settled = { success: `If ${email} has an account, a reset link is on its way. Check your inbox and junk folder.` };
  if (!emailConfigured()) return { error: "Email isn't switched on for this deployment yet." };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const next = kind === "certifier" ? "/login" : "/portal/set-password";
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${site}/auth/callback?next=${next}` },
  });
  if (error || !data?.properties?.action_link) return settled;

  await sendEmail(
    email,
    "Reset your CertFlow password",
    [
      `<p>Hi,</p>`,
      `<p>Here's the link to set a new password for your CertFlow ${kind === "certifier" ? "certifier" : "client portal"} login:</p>`,
      `<p><a href="${data.properties.action_link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">Set a new password</a></p>`,
      `<p>If you didn't ask for this, you can ignore this email — your password stays as it is.</p>`,
    ].join("")
  );
  return settled;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setPasswordAndAcceptInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error: pwError } = await supabase.auth.updateUser({ password });
  if (pwError) return { error: pwError.message };

  const { error: rpcError } = await supabase.rpc("accept_client_invite");
  if (rpcError) return { error: rpcError.message };

  redirect("/portal");
}
