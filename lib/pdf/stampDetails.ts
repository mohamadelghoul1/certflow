import { resolvePathwayCertRef, governingApproval, formatISODate, todayISO } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { fetchStampImage, measureStampText, type StampDetails } from "@/lib/pdf/stamp";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job, Firm, Certifier, Profile } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Works out whose name and registration number belong on the stamp.
//
// pathway_issued_by is only set once the certificate has actually been
// issued, so relying on it alone left the stamp blank at exactly the
// moment a certifier wants to look at it — while preparing the approval.
// Falls back to the certifier the job is assigned to, then to whoever is
// signed in, so the stamp always carries a real name and registration
// number rather than a pair of dashes.
export async function resolveStampCertifier(supabase: SupabaseClient, job: Job, profile: Profile): Promise<Certifier | null> {
  const candidates = [job.pathway_issued_by, job.assigned_certifier_id, profile.certifier_id].filter(Boolean) as string[];
  for (const id of candidates) {
    const { data } = await supabase.from("certifiers").select("*").eq("id", id).eq("firm_id", profile.firm_id).single();
    if (data) return data as Certifier;
  }
  return null;
}

// The whole stamp for a job, shared by the stamp preview and the combined
// approved set so the two can never show different details.
export async function buildStampDetails(supabase: SupabaseClient, job: Job, profile: Profile, firm: Firm | null, certRefOverride?: string | null): Promise<StampDetails> {
  const certifier = await resolveStampCertifier(supabase, job, profile);
  const d = job.details || {};
  // On a PC/OC job the plans were approved by another certifier, so the
  // stamp names their certificate rather than a reference of ours.
  const approval = governingApproval(job.pathway, d.priorApproval, resolvePathwayCertRef(certRefOverride, job.pathway, d.projectNumber || job.id.slice(0, 8), job.pathway_version));

  return {
    firmName: firm?.name || "",
    certRef: approval.ref,
    pathway: approval.label,
    certifierName: certifier?.name || "",
    registrationNo: certifier?.registration_no || "",
    date: formatISODate(job.pathway_signed_at || todayISO()),
    image: await fetchStampImage(await signedUrl(firm?.stamp_url, 3600, supabase)),
  };
}

// What the on-screen stamp positioner needs: the same details the printed
// stamp carries, its measured size, and a URL for the firm's artwork.
// Deliberately does not download the artwork the way buildStampDetails
// does — the browser fetches it itself, and a job screen shouldn't pull
// an image server-side just to draw a button.
export type StampPreview = { details: StampDetails; textWidth: number; textHeight: number; imageUrl: string | null };

export async function buildStampPreview(job: Job, certRefOverride?: string | null): Promise<StampPreview | null> {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();
  const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).single();
  const typedFirm = (firm || null) as Firm | null;
  const certifier = await resolveStampCertifier(supabase, job, profile);
  const d = job.details || {};
  const previewApproval = governingApproval(job.pathway, d.priorApproval, resolvePathwayCertRef(certRefOverride, job.pathway, d.projectNumber || job.id.slice(0, 8), job.pathway_version));
  const details: StampDetails = {
    firmName: typedFirm?.name || "",
    certRef: previewApproval.ref,
    pathway: previewApproval.label,
    certifierName: certifier?.name || "",
    registrationNo: certifier?.registration_no || "",
    date: formatISODate(job.pathway_signed_at || todayISO()),
    image: null,
  };
  const { textWidth, textHeight } = await measureStampText(details);
  return { details, textWidth, textHeight, imageUrl: await signedUrl(typedFirm?.stamp_url) };
}
