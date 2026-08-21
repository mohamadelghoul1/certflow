import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatISODate, resolvePathwayCertRef, calcCdcLapseDate } from "@/lib/business";
import type { Job, Firm, Certifier, ConditionOfConsent, CriticalStageInspection, JobDetails } from "@/types/db";

export function formatAddress(a?: Record<string, string> | null) {
  if (!a) return "—";
  const parts = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const rest = [a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
  return [parts, rest].filter(Boolean).join(", ") || "—";
}

// Street line / suburb-state-postcode line, split apart — used for the
// addressee block at the top of a letter (street address on its own line,
// like a real envelope), as opposed to formatAddress()'s single-line form
// used everywhere else (e.g. an "Address:" field-table value).
export function formatAddressLines(a?: Record<string, string> | null): string[] {
  if (!a) return ["—"];
  const parts = [a.streetNumber, a.street].filter(Boolean).join(" ");
  const rest = [a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
  const lines = [parts, rest].filter(Boolean);
  if (lines.length === 2) lines[0] = `${lines[0]},`;
  return lines;
}

// Falls back to showing whatever was typed rather than "$NaN" if the
// estimated cost field wasn't entered as a clean number.
export function formatCurrency(value?: string | null) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : value;
}

export type PathwayCertificateData = {
  job: Job;
  firm: Firm | null;
  issuedBy: Certifier | null;
  conditions: ConditionOfConsent[];
  allItems: { id: string; title: string; status: string; document_date: string | null }[];
  selectedInspections: CriticalStageInspection[];
  activeVersionId: string | null;
  signatureUrl: string | null;
  uploadedApprovalUrl: string | null;
  logoUrl: string | null;
  lapseDate: string;
  ref: string;
  projRef: string;
  isCdc: boolean;
  pathwayFull: string;
  d: JobDetails;
  cd: NonNullable<JobDetails["certificateDetails"]>;
  issuedDate: string;
  applicantName: string;
  applicantPhone?: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone?: string;
  councilBody: string[];
  applicantBody: string[];
  requiredDocsList: string[];
};

// Single source of truth for the CDC/CC certificate package's content —
// used by both the on-screen page (app/certificate/pathway/[jobId]/page.tsx)
// and the real .docx export (lib/docx/pathwayCertificate.ts), so the two
// can never drift apart the way a duplicated copy of this logic would.
export async function getPathwayCertificateData(jobId: string, firmId: string): Promise<PathwayCertificateData | null> {
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", firmId).single();
  if (!rawJob || !rawJob.pathway_generated) return null;
  const job = rawJob as Job;

  const [{ data: firm }, { data: conditions }, { data: issuedBy }, { data: checklists }, { data: inspections }, { data: activeVersion }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", firmId).single(),
    supabase.from("conditions_of_consent").select("*").eq("job_id", jobId).order("created_at"),
    job.pathway_issued_by ? supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single() : Promise.resolve({ data: null }),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("inspections").select("outcome").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("id, cert_ref").eq("job_id", jobId).eq("version", job.pathway_version).single(),
  ]);
  const signatureUrl = job.pathway_signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url) : null;
  const uploadedApprovalUrl = job.pathway_approval_uploaded ? await signedUrl(job.pathway_approval_file_path) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url) : null;

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  const allItems = ((pathwayChecklist?.checklist_items as never[]) || []) as {
    id: string;
    title: string;
    status: string;
    document_date: string | null;
  }[];

  const lapseDate = calcCdcLapseDate(
    job.pathway,
    job.details?.certificateDetails?.determinationDate,
    (nocChecklist?.checklist_items as never[]) || [],
    (inspections || []).map((i) => i.outcome)
  );

  const ref = resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version);
  const projRef = ref.split("/")[0];
  const isCdc = job.pathway === "CDC";
  const pathwayFull = isCdc ? "Complying Development Certificate" : "Construction Certificate";
  const d = job.details || {};
  const cd = d.certificateDetails || {};
  const issuedDate = formatISODate(job.pathway_generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";
  const applicantPhone = d.contact?.phone || d.contact?.mobile;
  const ownerName = d.ownerSameAsApplicant ? applicantName : d.owner?.name || applicantName;
  const ownerAddress = d.ownerSameAsApplicant ? formatAddress(d.applicantAddress) : formatAddress(d.owner?.address);
  const ownerPhone = d.ownerSameAsApplicant ? applicantPhone : d.owner?.phone;
  const selectedInspections = (job.critical_stage_inspections || []).filter((r) => r.enabled);

  const councilBody = job.council_letter_override
    ? job.council_letter_override.split("\n\n")
    : [
        `${firm?.name} Pty Ltd has issued a ${pathwayFull} under ${isCdc ? "Part 4" : "Sections 6.3, 6.4, 6.16"} of the Environmental Planning and Assessment Act 1979 for the above premises.`,
        ...(isCdc ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
        `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuedBy?.name || "—"}.`,
      ];

  const applicantBody = job.applicant_letter_override
    ? job.applicant_letter_override.split("\n\n")
    : [
        `One copy of each has been forwarded directly to ${d.council?.lga || "Council"} for their records.`,
        `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
        ...(isCdc ? [`Please note that no works can commence on site less than 7 days from the date of issuance of ${job.pathway}.`] : []),
        `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
        `The Principal Certifier role to be undertaken by ${issuedBy?.name || "—"} will require inspections and certification.`,
        `Please have the Owner/Builder or licensed contractor liaise with ${issuedBy?.name || "—"} prior to commencement of the work.`,
        `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
      ];

  const requiredDocsList = isCdc
    ? ["Receipt of the Council Contribution Fee.", "Receipt of the Council Bond.", "Builder’s Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.", "Erosion and Sediment Controls to be implemented on site.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."]
    : ["Erosion and Sediment Controls to be installed on site.", "Builder’s Home Warranty Certificate (HBCF) or Owner Builder Permit.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."];

  return {
    job,
    firm: firm || null,
    issuedBy: issuedBy || null,
    conditions: conditions || [],
    allItems,
    selectedInspections,
    activeVersionId: activeVersion?.id || null,
    signatureUrl,
    uploadedApprovalUrl,
    logoUrl,
    lapseDate,
    ref,
    projRef,
    isCdc,
    pathwayFull,
    d,
    cd,
    issuedDate,
    applicantName,
    applicantPhone,
    ownerName,
    ownerAddress,
    ownerPhone,
    councilBody,
    applicantBody,
    requiredDocsList,
  };
}
