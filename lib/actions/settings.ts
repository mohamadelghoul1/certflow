"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions/auth";

export async function updateFirm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { error } = await supabase
    .from("firms")
    .update({
      name: String(formData.get("name") || ""),
      abn: String(formData.get("abn") || ""),
      postal_address: String(formData.get("postal_address") || ""),
      office_address: String(formData.get("office_address") || ""),
      phone: String(formData.get("phone") || ""),
      email: String(formData.get("email") || ""),
      website: String(formData.get("website") || ""),
    })
    .eq("id", profile.firm_id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return undefined;
}

export async function addCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { error } = await supabase.from("certifiers").insert({
    firm_id: profile.firm_id,
    name: String(formData.get("name") || ""),
    registration_no: String(formData.get("registration_no") || ""),
    registration_body: String(formData.get("registration_body") || ""),
    pi_insurance_expiry: formData.get("pi_insurance_expiry") || null,
    registration_expiry: formData.get("registration_expiry") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return undefined;
}

export async function updateCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("certifiers")
    .update({
      name: String(formData.get("name") || ""),
      registration_no: String(formData.get("registration_no") || ""),
      registration_body: String(formData.get("registration_body") || ""),
      pi_insurance_expiry: formData.get("pi_insurance_expiry") || null,
      registration_expiry: formData.get("registration_expiry") || null,
    })
    .eq("id", id)
    .eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return undefined;
}

export async function removeCertifier(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("certifiers").delete().eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function addClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    firm_id: profile.firm_id,
    name: String(formData.get("name") || ""),
    type: String(formData.get("type") || "Other"),
    company: String(formData.get("company") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return undefined;
}

export async function inviteClient(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const clientId = String(formData.get("client_id"));

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("email").eq("id", clientId).eq("firm_id", profile.firm_id).single();
  if (!client?.email) return;

  const admin = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  await admin.auth.admin.inviteUserByEmail(client.email, {
    data: { firm_id: profile.firm_id, client_id: clientId },
    redirectTo: `${site}/auth/callback?next=/portal/set-password`,
  });
  revalidatePath("/settings");
}
