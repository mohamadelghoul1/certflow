import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { formatISODate, todayISO } from "@/lib/business";
import { resolveStampCertifier } from "@/lib/pdf/stampDetails";
import type { Job, Firm, Certifier, Profile } from "@/types/db";

// Everything the s134 neighbour notification letter merges in, gathered
// once and handed to whichever version is being produced — the editable
// Word file or the ready-to-print PDF. Shared so the two can never fall
// out of step over which applicant, which certifier or which planning
// instrument the letter names.

export type NeighbourLetterData = {
  firm: Firm | null;
  certifier: Certifier | null;
  jobAddress: string;
  description: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  applicantAddress: string;
  // The planning instrument this application is actually being assessed
  // under, and the part of it relied on. Both come from the code parts
  // ticked on the job, so a Housing SEPP 2021 job doesn't get a letter
  // citing the 2008 Codes SEPP.
  relevantInstrument: string;
  relevantPartOfCode: string;
  projRef: string; // the project number, for the page footer
  issuedDate: string; // today, formatted — the date on the letter
};

export type NeighbourLetterContext = {
  job: Job;
  data: NeighbourLetterData;
  // Left for the caller to fetch: the Word and PDF builders want the same
  // images at different sizes and in different forms.
  logoUrl: string | null;
  signatureUrl: string | null;
};

export async function getNeighbourLetterData(jobId: string, profile: Profile): Promise<NeighbourLetterContext | null> {
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return null;
  const job = rawJob as Job;
  const d = job.details || {};

  const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).single();
  const typedFirm = (firm || null) as Firm | null;
  const certifier = await resolveStampCertifier(supabase, job, profile);

  // The applicant details the letter offers neighbours, resolved the same
  // way the certificate resolves its applicant.
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "";

  return {
    job,
    logoUrl: await signedUrl(typedFirm?.logo_url),
    signatureUrl: await signedUrl(certifier?.signature_url),
    data: {
      firm: typedFirm,
      certifier,
      jobAddress: job.address || "",
      description: job.description || "",
      applicantName,
      applicantPhone: d.contact?.phone || d.contact?.mobile || "",
      applicantEmail: d.contact?.email || "",
      applicantAddress: formatAddress(d.applicantAddress),
      // The same instrument the certificate itself names — computed from
      // the ticked code parts, so both documents cite the same law.
      relevantInstrument: d.certificateDetails?.relevantInstrument || "",
      relevantPartOfCode: d.certificateDetails?.relevantPartOfCode || "",
      projRef: d.projectNumber || job.id.slice(0, 8),
      issuedDate: formatISODate(todayISO()),
    },
  };
}
