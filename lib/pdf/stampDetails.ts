import { resolvePathwayCertRef, formatISODate, todayISO } from "@/lib/business";
import { signedUrl } from "@/lib/storage";
import { fetchStampImage, type StampDetails } from "@/lib/pdf/stamp";
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
  const certRef = resolvePathwayCertRef(certRefOverride, job.pathway, d.projectNumber || job.id.slice(0, 8), job.pathway_version);

  return {
    firmName: firm?.name || "",
    certRef,
    pathway: job.pathway,
    certifierName: certifier?.name || "",
    registrationNo: certifier?.registration_no || "",
    date: formatISODate(job.pathway_signed_at || todayISO()),
    image: await fetchStampImage(await signedUrl(firm?.stamp_url)),
  };
}
