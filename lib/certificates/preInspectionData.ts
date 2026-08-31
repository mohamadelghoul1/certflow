import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { resolvePathwayCertRef, formatISODate } from "@/lib/business";
import { resolveStampCertifier } from "@/lib/pdf/stampDetails";
import type { Job, Firm, Certifier, Profile } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

// The pre-inspection report carried out before a certificate is issued.
//
// The same document under two names: for a CDC it is made under s139 of
// the Environmental Planning and Assessment Regulation 2021; for a CC
// under s16 of the EP&A (Development Certification and Fire Safety)
// Regulation 2021. A CC additionally names the development application it
// relies on, which a CDC has no equivalent of.
//
// Everything on it comes from the job — applicant, address, lot, zoning,
// scope, inspector — except the two dates the certifier types in where
// the certificate is issued.

export type PreInspectionRow = { area: string; outcome: string };

export type PreInspectionData = {
  job: Job;
  firm: Firm | null;
  inspector: Certifier | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  isCdc: boolean;
  // "139 EP and A Regulation 2021" / "S16 EP&A (Development Certification
  // and Fire Safety) Regulation 2021"
  regulationTitle: string;
  title: string;
  ref: string;
  projRef: string;
  address: string;
  applicantName: string;
  applicantAddress: string;
  applicantPhone: string;
  lga: string;
  developmentConsentNumber: string;
  certificateLabel: string;
  applicationDate: string;
  inspectionDate: string;
  lotSectionDp: string;
  zoning: string;
  scopeOfWorks: string;
  inspectorName: string;
  registrationNo: string;
  rows: PreInspectionRow[];
};

const CDC_REGULATION = "139 EP and A Regulation 2021";
const CC_REGULATION = "S16 EP&A (Development Certification and Fire Safety) Regulation 2021";

// The four areas the report covers, in the order the firm's own template
// sets them. Only the third differs between the two forms.
export function preInspectionRows(isCdc: boolean): PreInspectionRow[] {
  return [
    { area: "Details of the current fire safety measures in the existing building the subject of the inspection", outcome: "Satisfactory" },
    { area: "Do the plans and specifications adequately & accurately depict existing site conditions and/or existing buildings?", outcome: "Satisfactory" },
    { area: `Are there any features of the site/buildings that would mean the development cannot be a ${isCdc ? "CDC" : "CC"} or comply with the BCA?`, outcome: "Satisfactory" },
    { area: "Has any building work commenced?", outcome: "Satisfactory" },
  ];
}

// `modificationId` makes this the modification's own report: the dates
// come from the modification row, and the certificate number is the
// modified certificate's — the version it produced, or the version it is
// about to produce when it has not yet been issued.
export async function getPreInspectionData(jobId: string, profile: Profile, client?: SupabaseClient, modificationId?: string | null): Promise<PreInspectionData | null> {
  const supabase = client ?? (await createClient());

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!rawJob) return null;
  const job = rawJob as Job;

  // A PC/OC job issues no certificate of its own, so it has no
  // pre-inspection of this kind to report on.
  if (job.pathway !== "CDC" && job.pathway !== "CC") return null;

  const [{ data: firm }, { data: activeVersion }, { data: modification }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", profile.firm_id).single(),
    supabase.from("pathway_certificate_versions").select("cert_ref").eq("job_id", jobId).eq("version", job.pathway_version).single(),
    modificationId
      ? supabase.from("modifications").select("*").eq("id", modificationId).eq("job_id", jobId).single()
      : Promise.resolve({ data: null }),
  ]);
  if (modificationId && !modification) return null;
  const mod = modification as { generated: boolean; pre_application_date: string | null; pre_inspection_date: string | null } | null;
  const typedFirm = (firm || null) as Firm | null;
  const inspector = await resolveStampCertifier(supabase, job, profile);

  const d = job.details || {};
  const cd = d.certificateDetails || {};
  const isCdc = job.pathway === "CDC";
  const projRef = d.projectNumber || job.id.slice(0, 8);
  let ref = resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, projRef, job.pathway_version);
  if (mod && (!mod.generated || job.pathway_version <= 1)) {
    // A modification's certificate is never the /01 — its report shows
    // the number the modified certificate will carry. Projected from the
    // newest version when the modification has not been issued yet (or
    // was issued before issuing created the new version, so none exists):
    // the next version, and never lower than /02.
    const { data: newest } = await supabase.from("pathway_certificate_versions").select("version").eq("job_id", jobId).order("version", { ascending: false }).limit(1);
    ref = resolvePathwayCertRef(null, job.pathway, projRef, Math.max((newest?.[0]?.version || 0) + 1, 2));
  }
  const regulationTitle = isCdc ? CDC_REGULATION : CC_REGULATION;

  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "";

  return {
    job,
    firm: typedFirm,
    inspector,
    logoUrl: await signedUrl(typedFirm?.logo_url),
    signatureUrl: await signedUrl(inspector?.signature_url),
    isCdc,
    regulationTitle,
    title: `INSPECTION REPORT – ${ref} – 1. ${regulationTitle}`,
    ref,
    projRef,
    address: job.address || "",
    applicantName,
    applicantAddress: formatAddress(d.applicantAddress),
    applicantPhone: d.contact?.phone || d.contact?.mobile || "",
    lga: d.council?.lga || "",
    developmentConsentNumber: cd.developmentConsentNumber || "",
    certificateLabel: isCdc ? "CDC Number" : "Construction Certificate Number",
    applicationDate: mod
      ? mod.pre_application_date
        ? formatISODate(mod.pre_application_date)
        : ""
      : d.preInspection?.applicationDate
        ? formatISODate(d.preInspection.applicationDate)
        : "",
    inspectionDate: mod
      ? mod.pre_inspection_date
        ? formatISODate(mod.pre_inspection_date)
        : ""
      : d.preInspection?.inspectionDate
        ? formatISODate(d.preInspection.inspectionDate)
        : "",
    lotSectionDp: cd.lotSectionDp || "",
    zoning: d.zoning || "",
    scopeOfWorks: job.description || "",
    inspectorName: inspector?.name || "",
    registrationNo: inspector?.registration_no || "",
    rows: preInspectionRows(isCdc),
  };
}
