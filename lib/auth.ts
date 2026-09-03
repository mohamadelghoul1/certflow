import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { needsSecondFactor } from "@/lib/twoFactor";
import type { Profile } from "@/types/db";

// Loads the logged-in user's profile row, which is what every RLS policy
// keys off of (firm_id / role / certifier_id / client_id).
export async function requireProfile(kind: "certifier" | "client"): Promise<{ profile: Profile; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(kind === "client" ? "/client-login" : "/login");
  }

  // A certifier who has set up an authenticator app is not in until the
  // code has been given: a password-only session on such an account
  // opens nothing but the page that asks for the code.
  if (kind === "certifier") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsSecondFactor(aal)) redirect("/login/verify");
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    redirect(kind === "client" ? "/client-login" : "/login");
  }
  if (profile.role !== kind) {
    redirect(profile.role === "client" ? "/portal" : "/dashboard");
  }

  return { profile, userId: user.id };
}
