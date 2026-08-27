"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions/auth";

export async function updateFirm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const fields = {
    name: String(formData.get("name") || ""),
    abn: String(formData.get("abn") || ""),
    postal_address: String(formData.get("postal_address") || ""),
    office_address: String(formData.get("office_address") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    website: String(formData.get("website") || ""),
  };
  // The Portal account column arrived in migration 0032. On a database
  // that has not run it, save everything else rather than failing the form.
  const newer = {
    portal_email: String(formData.get("portal_email") || "").trim() || null,
  };
  const { error } = await supabase.from("firms").update({ ...fields, ...newer }).eq("id", profile.firm_id);
  if (error) {
    if (error.code !== "PGRST204" && error.code !== "42703") return { error: error.message };
    const { error: retryError } = await supabase.from("firms").update(fields).eq("id", profile.firm_id);
    if (retryError) return { error: retryError.message };
  }
  revalidatePath("/settings");
  return undefined;
}

// Each Settings section saves only its own columns, so pressing Save on
// one can never blank another's fields.
export async function updateFirmReminders(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const reminderDays = Math.min(90, Math.max(1, parseInt(String(formData.get("document_reminder_days") || "7"), 10) || 7));
  const { error } = await supabase
    .from("firms")
    .update({ document_reminders_enabled: formData.get("document_reminders_enabled") === "on", document_reminder_days: reminderDays })
    .eq("id", profile.firm_id);
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703") return { error: "Run database update 0033 first (System check shows what's been run)." };
    return { error: error.message };
  }
  revalidatePath("/settings");
  return undefined;
}

export async function updateFirmPayments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const reminderDays = Math.min(90, Math.max(1, parseInt(String(formData.get("invoice_reminder_days") || "7"), 10) || 7));
  const details = { payment_details: String(formData.get("payment_details") || "").trim() || null };
  const surcharge = { card_surcharge_enabled: formData.get("card_surcharge_enabled") === "on" };
  const reminders = {
    invoice_reminders_enabled: formData.get("invoice_reminders_enabled") === "on",
    invoice_reminder_days: reminderDays,
  };
  // Newest columns first, shedding a migration's worth at a time, so a
  // database mid-way through its updates still saves what it can hold.
  const isUnknown = (code: string | null | undefined) => code === "PGRST204" || code === "42703";
  const attempts = [{ ...details, ...surcharge, ...reminders }, { ...details, ...surcharge }, details];
  for (const [index, fields] of attempts.entries()) {
    const { error } = await supabase.from("firms").update(fields).eq("id", profile.firm_id);
    if (!error) break;
    if (!isUnknown(error.code)) return { error: error.message };
    if (index === attempts.length - 1) return { error: "Run database updates 0035–0038 first (System check shows what's been run)." };
  }
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
  // Blank stays null rather than an empty string, so "has this certifier
  // a practice of their own?" is a single test on the name.
  const text = (name: string) => String(formData.get(name) || "").trim() || null;
  const { error } = await supabase
    .from("certifiers")
    .update({
      name: String(formData.get("name") || ""),
      registration_no: String(formData.get("registration_no") || ""),
      registration_body: String(formData.get("registration_body") || ""),
      pi_insurance_expiry: formData.get("pi_insurance_expiry") || null,
      registration_expiry: formData.get("registration_expiry") || null,
      // A contract certifier's own practice. Blank means an employee,
      // whose inspection reports carry the firm's letterhead.
      practice_name: text("practice_name"),
      practice_abn: text("practice_abn"),
      practice_postal_address: text("practice_postal_address"),
      practice_office_address: text("practice_office_address"),
      practice_phone: text("practice_phone"),
      practice_email: text("practice_email"),
      practice_website: text("practice_website"),
      // The email this certifier signs into the NSW Planning Portal
      // with — what API submissions go up under. Added by migration 0031.
      portal_email: text("portal_email"),
    })
    .eq("id", id)
    .eq("firm_id", profile.firm_id);
  if (error) {
    // A database that has not run migration 0031 has no portal_email
    // column; save everything else rather than failing the whole form.
    if (error.code === "PGRST204" || error.code === "42703") {
      const { error: retryError } = await supabase
        .from("certifiers")
        .update({
          name: String(formData.get("name") || ""),
          registration_no: String(formData.get("registration_no") || ""),
          registration_body: String(formData.get("registration_body") || ""),
          pi_insurance_expiry: formData.get("pi_insurance_expiry") || null,
          registration_expiry: formData.get("registration_expiry") || null,
          practice_name: text("practice_name"),
          practice_abn: text("practice_abn"),
          practice_postal_address: text("practice_postal_address"),
          practice_office_address: text("practice_office_address"),
          practice_phone: text("practice_phone"),
          practice_email: text("practice_email"),
          practice_website: text("practice_website"),
        })
        .eq("id", id)
        .eq("firm_id", profile.firm_id);
      if (retryError) return { error: retryError.message };
    } else {
      return { error: error.message };
    }
  }
  revalidatePath("/settings");
  return undefined;
}

export async function updateCertifierPracticeLogo(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase
    .from("certifiers")
    .update({ practice_logo_url: String(formData.get("file_path")) })
    .eq("id", String(formData.get("id")))
    .eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifierPracticeLogo(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("certifiers").update({ practice_logo_url: null }).eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifier(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("certifiers").delete().eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateCertifierSignature(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("certifiers").update({ signature_url: filePath }).eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifierSignature(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("certifiers").update({ signature_url: null }).eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateFirmLogo(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const filePath = String(formData.get("file_path"));
  await supabase.from("firms").update({ logo_url: filePath }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeFirmLogo() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("firms").update({ logo_url: null }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateFirmStamp(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const filePath = String(formData.get("file_path"));
  await supabase.from("firms").update({ stamp_url: filePath }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeFirmStamp() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("firms").update({ stamp_url: null }).eq("id", profile.firm_id);
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

export async function updateClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase
    .from("clients")
    .update({
      name: String(formData.get("name") || ""),
      type: String(formData.get("type") || "Other"),
      company: String(formData.get("company") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
    })
    .eq("id", id)
    .eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return undefined;
}

export async function removeClient(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  await supabase.from("clients").delete().eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
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
