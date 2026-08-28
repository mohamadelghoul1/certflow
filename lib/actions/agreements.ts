"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import { escapeHtml } from "@/lib/html";
import { newSignatureToken, nameMatches, agreementProgress, type Signatory } from "@/lib/agreements";
import { buildSignedAgreement } from "@/lib/pdf/signedAgreement";
import { recordAuditEvent } from "@/lib/audit";
import { withinLimit, loginBucket, LOGIN_LIMIT } from "@/lib/rateLimit";

export type AgreementState = { error?: string; success?: string } | undefined;

// The certifier uploads the agreement they already use and names who has
// to sign it. Nothing is sent until they press Send.
export async function createAgreement(_prev: AgreementState, formData: FormData): Promise<AgreementState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const jobId = String(formData.get("job_id"));
  const filePath = String(formData.get("file_path") || "");
  const fileName = String(formData.get("file_name") || "");
  if (!filePath) return { error: "Upload the agreement document first." };

  const names = formData.getAll("signatory_name").map(String);
  const emails = formData.getAll("signatory_email").map(String);
  const roles = formData.getAll("signatory_role").map(String);
  const parties = names
    .map((name, i) => ({ name: name.trim(), email: (emails[i] || "").trim(), role: (roles[i] || "").trim() || null }))
    .filter((p) => p.name && p.email);
  if (parties.length === 0) return { error: "Add at least one person to sign, with their name and email address." };

  const { data: agreement, error } = await supabase
    .from("engagement_agreements")
    .insert({ job_id: jobId, firm_id: profile.firm_id, file_path: filePath, file_name: fileName || null })
    .select("id")
    .single();
  if (error || !agreement) return { error: error?.message || "Could not save the agreement." };

  const { error: partyError } = await supabase
    .from("engagement_signatories")
    .insert(parties.map((p) => ({ agreement_id: agreement.id, name: p.name, email: p.email, role: p.role, token: newSignatureToken() })));
  if (partyError) return { error: partyError.message };

  revalidatePath(`/jobs/${jobId}`);
  return { success: "Agreement ready to send." };
}

// Emails each outstanding signatory their own link. Safe to press again:
// anyone who has already signed is skipped, so this doubles as the
// chaser.
export async function sendAgreement(_prev: AgreementState, formData: FormData): Promise<AgreementState> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const agreementId = String(formData.get("agreement_id"));
  const jobId = String(formData.get("job_id"));
  if (!emailConfigured()) return { error: "Email isn't switched on for this deployment yet." };

  const { data: agreement } = await supabase
    .from("engagement_agreements")
    .select("id, job_id, jobs(address), engagement_signatories(id, name, email, token, signed_at)")
    .eq("id", agreementId)
    .eq("firm_id", profile.firm_id)
    .single();
  if (!agreement) return { error: "Agreement not found." };

  const { data: firm } = await supabase.from("firms").select("name").eq("id", profile.firm_id).single();
  const address = ((agreement.jobs as unknown as { address: string } | null)?.address) || "";
  const site = await siteUrl();

  type Party = { id: string; name: string; email: string; token: string; signed_at: string | null };
  const outstanding = ((agreement.engagement_signatories as Party[]) || []).filter((s) => !s.signed_at);
  if (outstanding.length === 0) return { error: "Everyone has already signed this agreement." };

  const failures: string[] = [];
  for (const party of outstanding) {
    const link = `${site}/sign/${party.token}`;
    const result = await sendEmail(
      party.email,
      `Agreement for signature${address ? ` — ${address}` : ""}`,
      [
        `<p>Dear ${escapeHtml(party.name)},</p>`,
        `<p>${escapeHtml(firm?.name || "Your certifier")} has prepared the engagement agreement${address ? ` for <strong>${escapeHtml(address)}</strong>` : ""} and it is ready for your signature.</p>`,
        `<p>Please review the agreement and sign it using the link below. It is personal to you — please don't forward it.</p>`,
        `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">Review and sign the agreement</a></p>`,
        `<p>Certification work cannot commence until the agreement has been signed by all parties.</p>`,
      ].join("")
    );
    if (result.sent) {
      await supabase.from("engagement_signatories").update({ sent_at: new Date().toISOString() }).eq("id", party.id);
    } else {
      failures.push(`${party.name}: ${result.error || "could not be emailed"}`);
    }
  }

  await supabase.from("engagement_agreements").update({ sent_at: new Date().toISOString() }).eq("id", agreementId);
  revalidatePath(`/jobs/${jobId}`);
  if (failures.length > 0) return { error: failures.join("; ") };
  return { success: `Sent to ${outstanding.length} ${outstanding.length === 1 ? "person" : "people"}.` };
}

// The executed contract: the firm's own document with every signature
// drawn into the execution block, and the signing record appended.
// Built once, when the last signature lands, and stored beside the
// original — the original is never altered.
async function buildAndStoreSignedCopy(admin: ReturnType<typeof createAdminClient>, agreementId: string) {
  try {
    const { data: agreement } = await admin
      .from("engagement_agreements")
      .select("id, job_id, firm_id, file_path, file_name, signature_page, signature_x, signature_y, signature_width, engagement_signatories(name, role, email, signed_name, signed_at, signature_image, signed_ip)")
      .eq("id", agreementId)
      .single();
    if (!agreement) return;

    const { data: file } = await admin.storage.from("certflow-files").download(agreement.file_path as string);
    if (!file) return;

    type Row = { name: string; role: string | null; email: string; signed_name: string | null; signed_at: string | null; signature_image: string | null; signed_ip: string | null };
    const parties = ((agreement.engagement_signatories as Row[]) || []).map((p) => ({
      name: p.name,
      role: p.role,
      email: p.email,
      signedName: p.signed_name,
      signedAt: p.signed_at,
      signatureImage: p.signature_image,
      signedIp: p.signed_ip,
    }));

    const placement =
      agreement.signature_page && agreement.signature_x != null && agreement.signature_y != null
        ? {
            page: Number(agreement.signature_page),
            x: Number(agreement.signature_x),
            y: Number(agreement.signature_y),
            width: Number(agreement.signature_width ?? 0.25),
          }
        : null;

    const merged = await buildSignedAgreement(new Uint8Array(await file.arrayBuffer()), parties, placement);
    const path = `${agreement.firm_id}/${agreement.job_id}/agreements/signed-${Date.now()}.pdf`;
    const { error } = await admin.storage.from("certflow-files").upload(path, merged, { contentType: "application/pdf" });
    if (error) return;
    await admin.from("engagement_agreements").update({ signed_file_path: path }).eq("id", agreementId);
  } catch (err) {
    // The signatures are safely recorded either way; only the merged
    // copy is missing, and it can be rebuilt.
    console.error("could not build the signed agreement", err);
  }
}

// Where on the contract the signatures belong — the certifier drags a
// box onto their own execution block once per agreement.
export async function setSignaturePlacement(formData: FormData): Promise<void> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const agreementId = String(formData.get("agreement_id"));
  const jobId = String(formData.get("job_id"));
  await supabase
    .from("engagement_agreements")
    .update({
      signature_page: Number(formData.get("page")) || 1,
      signature_x: Number(formData.get("x")),
      signature_y: Number(formData.get("y")),
      signature_width: Number(formData.get("width")) || 0.25,
    })
    .eq("id", agreementId)
    .eq("firm_id", profile.firm_id);
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeAgreement(formData: FormData) {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const agreementId = String(formData.get("agreement_id"));
  const jobId = String(formData.get("job_id"));
  // .select() so a delete that removed nothing is caught rather than
  // reported as success — the panel has already hidden it by the time
  // this runs, and it needs to know to put it back.
  const { data, error } = await supabase.from("engagement_agreements").delete().eq("id", agreementId).eq("firm_id", profile.firm_id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("That agreement could not be found to remove.");
  revalidatePath(`/jobs/${jobId}`);
}

export type SignState = { error?: string } | undefined;

// The signatory's own act, taken with no login: the token in their link
// is the authorisation, so everything here runs through the admin client
// and is scoped by that token alone. Rate limited, because a public
// endpoint that writes is a public endpoint that gets hammered.
export async function signAgreement(_prev: SignState, formData: FormData): Promise<SignState> {
  const token = String(formData.get("token") || "");
  const typedName = String(formData.get("signed_name") || "").trim();
  const declared = String(formData.get("declaration") || "") === "on";
  const drawn = String(formData.get("signature_image") || "").trim();
  if (!token) return { error: "This signing link is not valid." };
  if (!typedName) return { error: "Please type your full name to sign." };
  if (!declared) return { error: "Please tick the declaration to confirm you agree to be bound by this agreement." };

  const admin = createAdminClient();
  if (!(await withinLimit(admin, loginBucket(`sign:${token.slice(0, 24)}`), LOGIN_LIMIT))) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

  const { data: party } = await admin
    .from("engagement_signatories")
    .select("id, name, signed_at, agreement_id, engagement_agreements(id, job_id, firm_id, jobs(address))")
    .eq("token", token)
    .single();
  if (!party) return { error: "This signing link is not valid." };
  if (party.signed_at) return { error: "This agreement has already been signed." };
  if (!nameMatches(party.name, typedName)) {
    return { error: `Please sign as ${party.name}. If you are signing on their behalf, contact the certifier so the agreement can be reissued in your name.` };
  }

  // The signature itself, and it is required — a tick alone is not a
  // signature, and this image is what gets drawn into the contract.
  // Only ever an inline image: anything else is refused rather than
  // stored and later rendered.
  const signature = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(drawn) && drawn.length < 400_000 ? drawn : null;
  if (!signature) return { error: "Please sign in the box — draw your signature, or use “Write it for me” to have it written from your name." };

  const head = await headers();
  const { error } = await admin
    .from("engagement_signatories")
    .update({
      signed_at: new Date().toISOString(),
      signed_name: typedName,
      signature_image: signature,
      signed_ip: head.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      signed_user_agent: head.get("user-agent"),
    })
    .eq("id", party.id)
    .is("signed_at", null);
  if (error) return { error: "That signature could not be saved. Please try again." };

  const agreement = party.engagement_agreements as unknown as { id: string; job_id: string; firm_id: string; jobs: { address: string } | null } | null;
  if (agreement) await afterSignature(admin, agreement, typedName);
  return undefined;
}

// Tell the certifier, and mark the agreement complete once the last
// signature is in.
async function afterSignature(
  admin: ReturnType<typeof createAdminClient>,
  agreement: { id: string; job_id: string; firm_id: string; jobs: { address: string } | null },
  typedName: string
) {
  const address = agreement.jobs?.address || "";
  const { data: parties } = await admin.from("engagement_signatories").select("id, name, email, role, signed_at, signed_name").eq("agreement_id", agreement.id);
  const progress = agreementProgress((parties || []) as Signatory[]);

  if (progress.complete) {
    await admin.from("engagement_agreements").update({ completed_at: new Date().toISOString() }).eq("id", agreement.id);
    await buildAndStoreSignedCopy(admin, agreement.id);
  }

  await recordAuditEvent(admin, {
    firmId: agreement.firm_id,
    action: "agreement.signed",
    summary: progress.complete
      ? `Engagement agreement signed by all parties (${typedName} signed last)`
      : `Engagement agreement signed by ${typedName} — ${progress.signed} of ${progress.total}`,
    jobId: agreement.job_id,
    jobAddress: address,
    detail: { signed: progress.signed, total: progress.total },
  });

  const { notifyJobCertifier } = await import("@/lib/email");
  await notifyJobCertifier(
    admin,
    agreement.job_id,
    progress.complete ? `Engagement agreement fully signed${address ? ` — ${address}` : ""}` : `Agreement signed by ${typedName}${address ? ` — ${address}` : ""}`,
    progress.complete
      ? `<p>The engagement agreement${address ? ` for <strong>${escapeHtml(address)}</strong>` : ""} has now been signed by every party. The signing record is on the project.</p>`
      : `<p><strong>${escapeHtml(typedName)}</strong> has signed the engagement agreement${address ? ` for <strong>${escapeHtml(address)}</strong>` : ""}. ${progress.outstanding.length} still to sign: ${escapeHtml(
          progress.outstanding.map((s) => s.name).join(", ")
        )}.</p>`
  );
}
