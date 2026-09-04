import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { needsSecondFactor } from "@/lib/twoFactor";
import { directorFromAnswer } from "@/lib/roles";
import type { Profile } from "@/types/db";

export type Session = { profile: Profile; userId: string; director: boolean };

// Loads the logged-in user's profile row, which is what every RLS policy
// keys off of (firm_id / role / certifier_id / client_id).
export async function requireProfile(kind: "certifier" | "client"): Promise<Session> {
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

  // Whether this certifier runs the firm or works on the projects they
  // have been given. The database is asked, since it is the database
  // that enforces the answer; a database without migration 0072 has no
  // such question and every certifier is what they always were.
  let director = kind === "certifier";
  if (kind === "certifier") {
    const { data, error } = await supabase.rpc("is_director");
    director = directorFromAnswer(data, error);
  }

  return { profile, userId: user.id, director };
}

// The pages and actions that are the firm's to run, not a team
// member's: money, the firm's settings, its records of itself. A team
// member who follows an old link lands on their dashboard.
export async function requireDirector(): Promise<Session> {
  const session = await requireProfile("certifier");
  if (!session.director) redirect("/dashboard?directors=only");
  return session;
}
