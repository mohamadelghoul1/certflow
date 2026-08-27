"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendEmail, emailConfigured } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import type { ActionState } from "@/lib/actions/auth";

export type InviteState = { error?: string; success?: string } | undefined;

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
  const base = {
    firm_id: profile.firm_id,
    name: String(formData.get("name") || ""),
    registration_no: String(formData.get("registration_no") || ""),
    registration_body: String(formData.get("registration_body") || ""),
    pi_insurance_expiry: formData.get("pi_insurance_expiry") || null,
    registration_expiry: formData.get("registration_expiry") || null,
  };
  const email = String(formData.get("email") || "").trim() || null;
  const { error } = await supabase.from("certifiers").insert({ ...base, email });
  if (error) {
    // A database that hasn't run migration 0040 has no email column —
    // save the certifier without it rather than failing the whole form.
    if (error.code !== "PGRST204" && error.code !== "42703") return { error: error.message };
    const { error: retryError } = await supabase.from("certifiers").insert(base);
    if (retryError) return { error: retryError.message };
  }
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
      // Where CertFlow's own notifications to them go. Added by 0040.
      email: text("email"),
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

// Invites used to ride Supabase's built-in mailer, which is capped at a
// couple of emails an hour and swallows its failures — an invite that
// never arrived looked exactly like one that did. The link is now
// minted directly and sent through the same email service as everything
// else, and every outcome is said out loud.
export async function inviteClient(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { profile } = await requireProfile("certifier");
  const clientId = String(formData.get("client_id"));

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name, email, user_id").eq("id", clientId).eq("firm_id", profile.firm_id).single();
  if (!client?.email) return { error: "This contact has no email address — add one first." };
  if (!emailConfigured()) return { error: "Email isn't switched on for this deployment (RESEND_API_KEY)." };

  const admin = createAdminClient();
  const site = await siteUrl();

  // A fresh contact gets an invite; one who already holds a login gets a
  // set-a-new-password link — re-inviting an existing user is the exact
  // call Supabase silently refuses.
  const { data: linkData, error } = await admin.auth.admin.generateLink(
    client.user_id
      ? { type: "recovery", email: client.email }
      : { type: "invite", email: client.email, options: { data: { firm_id: profile.firm_id, client_id: clientId } } }
  );
  if (error || !linkData?.properties?.hashed_token) {
    if (/already.*registered|already.*exists/i.test(error?.message || "")) {
      return {
        error: `${client.email} already has a CertFlow login. If that's your own certifier email, use a different address for the client — one login can't be both certifier and client.`,
      };
    }
    return { error: error?.message || "The invite link could not be created." };
  }

  // Straight to our own route with the one-time token — see
  // app/auth/confirm/route.ts for why not Supabase's own link.
  const link = `${site}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=${
    client.user_id ? "recovery" : "invite"
  }&next=${encodeURIComponent("/portal/set-password")}`;

  const result = await sendEmail(
    client.email,
    "Your CertFlow client portal access",
    [
      `<p>Hi ${client.name || "there"},</p>`,
      `<p>You've been given access to the client portal for your project with us. Set your password to get started:</p>`,
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">${
        client.user_id ? "Set a new password" : "Set up my portal access"
      }</a></p>`,
      `<p>From the portal you can see your project's progress, upload requested documents, and download what we send you.</p>`,
    ].join("")
  );
  if (!result.sent) return { error: result.error || "The email could not be sent." };

  revalidatePath("/settings");
  return { success: `Invite emailed to ${client.email}.` };
}
