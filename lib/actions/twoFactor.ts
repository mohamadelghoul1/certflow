"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { needsSecondFactor, normaliseCode } from "@/lib/twoFactor";

// Setting up, using, and switching off the second step of signing in.
//
// The authenticator app on the certifier's phone is the second factor.
// Supabase holds the secret and checks the codes; these actions only
// carry the steps across: start an enrolment, confirm it with the first
// code, verify a code at sign-in, and take it off again.

export type SetupState = { error?: string; factorId?: string; qrCode?: string; secret?: string; done?: boolean } | undefined;
export type CodeState = { error?: string } | undefined;

const WRONG_CODE = "That code wasn't accepted. Codes change every 30 seconds — try the one showing now.";

// Begins an enrolment: a fresh secret, shown as a QR code and as text.
// Any half-finished enrolment from an earlier attempt is dropped first,
// so the account never carries a factor nobody can use.
export async function beginTwoFactorSetup(): Promise<SetupState> {
  await requireProfile("certifier");
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all || []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error || !data) return { error: error?.message || "Two-factor sign-in could not be started." };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

// The first code proves the app was set up from this secret. From here
// on every sign-in asks for one.
export async function confirmTwoFactorSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const factorId = String(formData.get("factor_id") || "");
  const code = normaliseCode(String(formData.get("code") || ""));
  const qrCode = String(formData.get("qr_code") || "");
  const secret = String(formData.get("secret") || "");
  if (!factorId) return { error: "Start the set-up again." };
  if (!code) return { error: "Enter the six-digit code from your authenticator app.", factorId, qrCode, secret };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: WRONG_CODE, factorId, qrCode, secret };
  revalidatePath("/settings");
  return { done: true };
}

export async function cancelTwoFactorSetup(formData: FormData) {
  await requireProfile("certifier");
  const supabase = await createClient();
  const factorId = String(formData.get("factor_id") || "");
  if (factorId) await supabase.auth.mfa.unenroll({ factorId });
  revalidatePath("/settings");
}

// Switching it off needs a session that has already passed the second
// step — Supabase refuses otherwise, which is the point: a stolen
// password alone cannot remove the thing that stops a stolen password.
export async function disableTwoFactor(_prev: CodeState, formData: FormData): Promise<CodeState> {
  await requireProfile("certifier");
  const supabase = await createClient();
  const factorId = String(formData.get("factor_id") || "");
  if (!factorId) return { error: "Nothing to switch off." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: "It couldn't be switched off from this session. Sign out, sign in again with your code, and try once more." };
  revalidatePath("/settings");
  return undefined;
}

// The second step at sign-in. The password has already been accepted;
// this checks a code against the one verified authenticator and, if it
// matches, the session steps up and the dashboard opens.
export async function verifySecondFactor(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!needsSecondFactor(aal)) redirect("/dashboard");

  const code = normaliseCode(String(formData.get("code") || ""));
  if (!code) return { error: "Enter the six-digit code from your authenticator app." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect("/dashboard");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: WRONG_CODE };
  redirect("/dashboard");
}
