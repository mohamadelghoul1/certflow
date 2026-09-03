"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { withinLimit, loginBucket, LOGIN_LIMIT } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured, firmSender } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import { needsSecondFactor } from "@/lib/twoFactor";

const TOO_MANY = "Too many sign-in attempts for this email address. Wait a minute and try again.";

// What a form gets back. An error to show, or the moment the save
// landed — a timestamp rather than a flag so that saving twice is two
// events, and the confirmation appears again the second time.
export type ActionState = { error?: string; savedAt?: number } | undefined;

export async function signInCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  if (!(await withinLimit(supabase, loginBucket(email), LOGIN_LIMIT))) return { error: TOO_MANY };

  // The sign-in answer already carries the user; asking the auth server
  // for them again was a second round trip on the slowest step there is.
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign-in did not complete. Try again." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if (!profile || profile.role !== "certifier") {
    await supabase.auth.signOut();
    return { error: "This login isn't set up as a certifier account." };
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(needsSecondFactor(aal) ? "/login/verify" : "/dashboard");
}

export async function signInClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  if (!(await withinLimit(supabase, loginBucket(email), LOGIN_LIMIT))) return { error: TOO_MANY };

  // The sign-in answer already carries the user; asking the auth server
  // for them again was a second round trip on the slowest step there is.
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign-in did not complete. Try again." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
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
// like every other Certlyn email, rather than Supabase's capped mailer.
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

  const site = await siteUrl();
  const next = kind === "certifier" ? "/set-password" : "/portal/set-password";
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) return settled;
  const link = `${site}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=${encodeURIComponent(next)}`;

  // Whose firm this login belongs to, so the reset arrives from them
  // rather than from whoever this deployment belongs to. Nobody is
  // logged in yet, so it is looked up with the service-role client —
  // and the reply is the same either way, so this reveals nothing about
  // whether the address is known.
  const { data: profile } = data.user?.id
    ? await admin.from("profiles").select("firm_id").eq("id", data.user.id).maybeSingle()
    : { data: null };
  const sender = profile?.firm_id ? await firmSender(admin, profile.firm_id, admin) : undefined;

  await sendEmail(
    email,
    "Reset your Certlyn password",
    [
      `<p>Hi,</p>`,
      `<p>Here's the link to set a new password for your Certlyn ${kind === "certifier" ? "certifier" : "client portal"} login:</p>`,
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">Set a new password</a></p>`,
      `<p>If you didn't ask for this, you can ignore this email — your password stays as it is.</p>`,
    ].join(""),
    undefined,
    sender
  );
  return settled;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// A certifier setting a new password after following a reset link. The
// client's version accepts an invite on the way through; a certifier
// has no invite to accept, so this is the plain half.
export async function setCertifierPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "That link has expired. Ask for a new one from the sign-in page." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
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
