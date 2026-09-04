"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, requireDirector, type Session } from "@/lib/auth";
import { isFirmRole, canChangeRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { firmSender, sendEmail, firmEmailConfigured } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import type { ActionState } from "@/lib/actions/auth";

export type InviteState = { error?: string; success?: string } | undefined;

// What PostgREST says when the database has not had the migration run
// that creates the function being called.
const MISSING_FUNCTION = ["PGRST202", "42883"];

// A certifier's card is theirs to keep up — signature, mobile, the
// Portal login — and everyone else's is the director's. The database
// holds the same line (migration 0072); this is the app agreeing with
// it before the form is even sent.
async function requireOwnCardOrDirector(certifierId: string): Promise<Session> {
  const session = await requireProfile("certifier");
  if (!session.director && session.profile.certifier_id !== certifierId) redirect("/dashboard?directors=only");
  return session;
}

export async function updateFirm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  // The sending address used to be edited here too. It has its own
  // section now — Settings → Email sending, where it sits beside the
  // Resend account that has to agree with it — and two forms owning the
  // same two columns is how one silently undoes the other.
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
  return { savedAt: Date.now() };
}

// Each Settings section saves only its own columns, so pressing Save on
// one can never blank another's fields.
export async function updateFirmReminders(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  return { savedAt: Date.now() };
}

export async function updateFirmPayments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  return { savedAt: Date.now() };
}

// The address this firm's clients see, and where their replies land.
//
// Migration 0058 added the columns; until now only a hand-written SQL
// statement could fill them, which meant a second firm's certificates
// and invoices went out under the first firm's name. This is the form.
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Accepts either a bare address or the "Their Firm <mail@theirs.com.au>"
// form Resend takes, and reports which part is wrong rather than only
// that something is.
function senderAddressProblem(value: string, label: string): string | null {
  const angled = value.match(/^(.+?)\s*<([^>]+)>$/);
  const address = angled ? angled[2].trim() : value;
  if (angled && !angled[1].trim()) return `Put your firm's name before the angle brackets in ${label}, or just give the address on its own.`;
  if (!ADDRESS.test(address)) return `${label} doesn't look like an email address — for example Your Firm <mail@yourfirm.com.au>.`;
  return null;
}

export async function updateFirmSender(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const fromEmail = String(formData.get("from_email") || "").trim();
  const replyToEmail = String(formData.get("reply_to_email") || "").trim();

  if (fromEmail) {
    const problem = senderAddressProblem(fromEmail, "The sending address");
    if (problem) return { error: problem };
  }
  if (replyToEmail) {
    const problem = senderAddressProblem(replyToEmail, "The reply-to address");
    if (problem) return { error: problem };
  }

  const { error } = await supabase
    .from("firms")
    .update({ from_email: fromEmail || null, reply_to_email: replyToEmail || null })
    .eq("id", profile.firm_id);
  if (error) {
    return { error: error.code === "PGRST204" || error.code === "42703" ? "Run database update 0058 first (Settings → System check)." : error.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

// Connecting a firm's own Resend account.
//
// Stored and read exactly like the Stripe keys: written through a
// database function, never readable by anything holding a login. See
// migration 0060.
export async function saveFirmEmailKey(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireDirector();
  const supabase = await createClient();
  const apiKey = String(formData.get("resend_api_key") || "").trim();
  if (!apiKey) return { error: "Paste your Resend API key first." };
  if (!apiKey.startsWith("re_")) return { error: "That doesn't look like a Resend API key — they start with re_." };

  const { error } = await supabase.rpc("set_firm_email_api_key", { p_api_key: apiKey });
  if (error) {
    return { error: MISSING_FUNCTION.includes(error.code) ? "Run database update 0060 first (Settings → System check)." : error.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

export async function disconnectFirmEmailKey(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireDirector();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_firm_email_api_key");
  if (error) {
    return { error: MISSING_FUNCTION.includes(error.code) ? "Run database update 0060 first (Settings → System check)." : error.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

// Connecting a firm's own Stripe account.
//
// The keys are written through a database function and never read back:
// migration 0059 gives the table no read policy, so a certifier can set
// a key and be told it is set, but nothing holding a login — theirs
// included — can select the value. That is what keeps a Stripe secret
// key off a page that is sent to a browser.
//
// A blank box means "leave what is stored alone", so the webhook secret
// can be filled in a week after the key without retyping the key.
export async function saveFirmStripe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireDirector();
  const supabase = await createClient();
  const secretKey = String(formData.get("stripe_secret_key") || "").trim();
  const webhookSecret = String(formData.get("stripe_webhook_secret") || "").trim();
  if (!secretKey && !webhookSecret) return { error: "Nothing to save — paste a key or a signing secret first." };

  // Caught early and by shape only, so a mistyped box says so here
  // rather than as a Stripe error on the first client who tries to pay.
  if (secretKey && !/^(sk|rk)_(test|live)_/.test(secretKey)) {
    return { error: "That doesn't look like a Stripe secret key — they start with sk_live_ or sk_test_." };
  }
  if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
    return { error: "That doesn't look like a Stripe signing secret — they start with whsec_." };
  }

  const { error } = await supabase.rpc("set_firm_stripe_credentials", {
    p_secret_key: secretKey || null,
    p_webhook_secret: webhookSecret || null,
  });
  if (error) {
    return { error: MISSING_FUNCTION.includes(error.code) ? "Run database update 0059 first (Settings → System check)." : error.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

export async function disconnectFirmStripe(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireDirector();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_firm_stripe_credentials");
  if (error) {
    return { error: MISSING_FUNCTION.includes(error.code) ? "Run database update 0059 first (Settings → System check)." : error.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

export async function addCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  const mobile = String(formData.get("mobile") || "").trim() || null;
  // A new certifier is a team member unless the director says otherwise.
  const role = formData.get("firm_role");
  const firm_role = isFirmRole(role) ? role : "staff";
  const { error } = await supabase.from("certifiers").insert({ ...base, email, mobile, firm_role });
  if (error) {
    // A database that hasn't run migration 0040 has no email column,
    // 0054 no mobile, 0072 no role — save the certifier without them
    // rather than failing the whole form.
    if (error.code !== "PGRST204" && error.code !== "42703") return { error: error.message };
    const { error: retryError } = await supabase.from("certifiers").insert(base);
    if (retryError) return { error: retryError.message };
  }
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}

export async function updateCertifier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, director } = await requireOwnCardOrDirector(String(formData.get("id")));
  const supabase = await createClient();
  const id = String(formData.get("id"));
  // Only a director changes a role, and never their own: the last
  // director stepping down would leave a firm nobody runs.
  const role = formData.get("firm_role");
  const roleChange = director && isFirmRole(role) && canChangeRole(id, profile.certifier_id) ? { firm_role: role } : {};
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
      // Where Certlyn's own notifications to them go. Added by 0040.
      email: text("email"),
      // The mobile a client rings to move a booked inspection. Kept
      // apart from the firm's office line, which is what prints on
      // certificates. Added by 0054.
      mobile: text("mobile"),
      ...roleChange,
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
  return { savedAt: Date.now() };
}

export async function updateCertifierPracticeLogo(formData: FormData) {
  const { profile } = await requireOwnCardOrDirector(String(formData.get("id")));
  const supabase = await createClient();
  await supabase
    .from("certifiers")
    .update({ practice_logo_url: String(formData.get("file_path")) })
    .eq("id", String(formData.get("id")))
    .eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifierPracticeLogo(formData: FormData) {
  const { profile } = await requireOwnCardOrDirector(String(formData.get("id")));
  const supabase = await createClient();
  await supabase.from("certifiers").update({ practice_logo_url: null }).eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifier(formData: FormData) {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  await supabase.from("certifiers").delete().eq("id", String(formData.get("id"))).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateCertifierSignature(formData: FormData) {
  const { profile } = await requireOwnCardOrDirector(String(formData.get("id")));
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const filePath = String(formData.get("file_path"));
  await supabase.from("certifiers").update({ signature_url: filePath }).eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeCertifierSignature(formData: FormData) {
  const { profile } = await requireOwnCardOrDirector(String(formData.get("id")));
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("certifiers").update({ signature_url: null }).eq("id", id).eq("firm_id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateFirmLogo(formData: FormData) {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const filePath = String(formData.get("file_path"));
  await supabase.from("firms").update({ logo_url: filePath }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeFirmLogo() {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  await supabase.from("firms").update({ logo_url: null }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function updateFirmStamp(formData: FormData) {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  const filePath = String(formData.get("file_path"));
  await supabase.from("firms").update({ stamp_url: filePath }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function removeFirmStamp() {
  const { profile } = await requireDirector();
  const supabase = await createClient();
  await supabase.from("firms").update({ stamp_url: null }).eq("id", profile.firm_id);
  revalidatePath("/settings");
}

export async function addClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  return { savedAt: Date.now() };
}

export async function updateClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireDirector();
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
  return { savedAt: Date.now() };
}

export async function removeClient(formData: FormData) {
  const { profile } = await requireDirector();
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
  const { profile } = await requireDirector();
  const clientId = String(formData.get("client_id"));

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name, email, user_id").eq("id", clientId).eq("firm_id", profile.firm_id).single();
  if (!client?.email) return { error: "This contact has no email address — add one first." };
  if (!(await firmEmailConfigured(supabase))) return { error: "Email isn't switched on yet — connect your Resend account in Settings → Email sending." };

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
        error: `${client.email} already has a Certlyn login. If that's your own certifier email, use a different address for the client — one login can't be both certifier and client.`,
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
    "Your Certlyn client portal access",
    [
      `<p>Hi ${client.name || "there"},</p>`,
      `<p>You've been given access to the client portal for your project with us. Set your password to get started:</p>`,
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">${
        client.user_id ? "Set a new password" : "Set up my portal access"
      }</a></p>`,
      `<p>From the portal you can see your project's progress, upload requested documents, and download what we send you.</p>`,
    ].join(""),
    undefined,
    // The client is being invited by a firm, and should see that firm's
    // name on the invitation rather than the deployment's.
    await firmSender(supabase, profile.firm_id)
  );
  if (!result.sent) return { error: result.error || "The email could not be sent." };

  revalidatePath("/settings");
  return { success: `Invite emailed to ${client.email}.` };
}

// A certifier's own sign-in, sent by the director. Same shape as the
// client invite above: the link is minted here and goes out through the
// firm's own sender, so a lost invite is a reported failure rather than
// a silence. What makes the invite safe is not the email but the row:
// the new login's id is written onto the certifier's card by the
// director, and finishing the sign-in (accept_certifier_invite, 0072)
// trusts that and nothing the person typed.
export async function inviteCertifier(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { profile } = await requireDirector();
  const certifierId = String(formData.get("certifier_id"));

  const supabase = await createClient();
  const { data: certifier } = await supabase.from("certifiers").select("name, email, user_id, firm_role").eq("id", certifierId).eq("firm_id", profile.firm_id).single();
  if (!certifier) return { error: "That certifier is no longer on the list." };
  if (!certifier.email) return { error: "Add an email for notifications to this certifier first — that is the address they sign in with." };
  if (!(await firmEmailConfigured(supabase))) return { error: "Email isn't switched on yet — connect your Resend account in Settings → Email sending." };

  const admin = createAdminClient();
  const site = await siteUrl();

  const { data: linkData, error } = await admin.auth.admin.generateLink(
    certifier.user_id
      ? { type: "recovery", email: certifier.email }
      : { type: "invite", email: certifier.email, options: { data: { firm_id: profile.firm_id, certifier_id: certifierId } } }
  );
  if (error || !linkData?.properties?.hashed_token) {
    if (/already.*registered|already.*exists/i.test(error?.message || "")) {
      return { error: `${certifier.email} already has a Certlyn login under another firm or as a client. Use a different address for them here.` };
    }
    return { error: error?.message || "The invite link could not be created." };
  }

  // The card learns which login is theirs. Done before the email goes,
  // so a link that arrives always has a card waiting for it.
  if (!certifier.user_id && linkData.user?.id) {
    const { error: linkError } = await supabase.from("certifiers").update({ user_id: linkData.user.id }).eq("id", certifierId).eq("firm_id", profile.firm_id);
    if (linkError) return { error: linkError.message };
  }

  const link = `${site}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=${certifier.user_id ? "recovery" : "invite"}&next=${encodeURIComponent("/set-password")}`;
  const { data: firm } = await supabase.from("firms").select("name").eq("id", profile.firm_id).single();
  const firmName = firm?.name || "your firm";

  const result = await sendEmail(
    certifier.email,
    `Your Certlyn login for ${firmName}`,
    [
      `<p>Hi ${certifier.name || "there"},</p>`,
      `<p>${firmName} has set you up on Certlyn, the software the firm runs its certification work on. Choose a password to get started:</p>`,
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">${
        certifier.user_id ? "Set a new password" : "Set up my login"
      }</a></p>`,
      certifier.firm_role === "director"
        ? `<p>You have been made a director, with access to everything the firm does on Certlyn.</p>`
        : `<p>You will see the projects and inspections the firm assigns to you. From your phone, <strong>On site</strong> is the inspection screen.</p>`,
    ].join(""),
    undefined,
    await firmSender(supabase, profile.firm_id)
  );
  if (!result.sent) return { error: result.error || "The email could not be sent." };

  revalidatePath("/settings");
  return { success: `Invite emailed to ${certifier.email}.` };
}
