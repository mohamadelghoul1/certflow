import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { needsSecondFactor } from "@/lib/twoFactor";
import { roleFromAnswer, canWriteJob, type FirmRole } from "@/lib/roles";
import { isPlatformOwner } from "@/lib/platformOwner";
import type { Profile } from "@/types/db";

export type Session = { profile: Profile; userId: string; firmRole: FirmRole; director: boolean };

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

  // Whether this certifier runs the firm, works the projects they are
  // given, or only inspects — read off their own certifier card, which
  // is the same fact the database enforces. A database without
  // migration 0072 has no such column and every certifier is what they
  // always were.
  let firmRole: FirmRole = "director";
  if (kind === "certifier" && profile.certifier_id) {
    const { data, error } = await supabase.from("certifiers").select("firm_role").eq("id", profile.certifier_id).single();
    firmRole = roleFromAnswer((data as { firm_role?: string } | null)?.firm_role, error);
  }

  return { profile, userId: user.id, firmRole, director: firmRole === "director" };
}

// The actions that change what a project is — its details, checklists,
// documents, certificates, bookings, and the Portal record. A director
// or team member passes; an inspector reads and inspects only.
export async function requireJobWriter(): Promise<Session> {
  const session = await requireProfile("certifier");
  if (!canWriteJob(session.firmRole)) redirect("/dashboard?directors=only");
  return session;
}

// The handful of pages that belong to the firm that runs Certlyn
// rather than to a firm using it: what every firm has used, and what
// each is being charged. The database agrees (is_platform_owner, added
// by migration 0076), so this is the screen door on a locked door.
export async function requirePlatformOwner(): Promise<Session> {
  const session = await requireDirector();
  const supabase = await createClient();
  if (!(await isPlatformOwner(supabase, session.profile.firm_id))) redirect("/dashboard?directors=only");
  return session;
}

// The pages and actions that are the firm's to run, not a team
// member's: money, the firm's settings, its records of itself. A team
// member who follows an old link lands on their dashboard.
export async function requireDirector(): Promise<Session> {
  const session = await requireProfile("certifier");
  if (!session.director) redirect("/dashboard?directors=only");
  return session;
}
