"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ActionState = { error?: string } | undefined;

export async function signInCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
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
