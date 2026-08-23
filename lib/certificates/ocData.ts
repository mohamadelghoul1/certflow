import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrl } from "@/lib/storage";
import { formatISODate, resolvePathwayCertRef, resolveOcCertRef, governingApproval } from "@/lib/business";
import type { Job, Firm, OcRecord, JobDetails } from "@/types/db";

// drawing_number is the stored column name; it holds any document
// reference, not only a drawing number.
type OcChecklistItem = { id: string; title: string; status: string; revision: string | null; document_date: string | null; prepared_by: string | null; drawing_number: string | null };
type OcIssuer = { name: string; registration_no: string | null; registration_body: string | null; signature_url: string | null };

export type OcCertificateData = {
  job: Job;
  firm: Firm | null;
  record: OcRecord;
  issuedBy: OcIssuer | null;
  approvedItems: OcChecklistItem[];
  signatureUrl: string | null;
  uploadedApprovalUrl: string | null;
  logoUrl: string | null;
  ref: string;
  projRef: string;
  typeLabel: string;
  consentRef: string;
  // "CDC" or "CC" — what to call the approval on the certificate.
  consentLabel: string;
  // The development consent the work was approved under. Only a CC job
  // has one — a complying development certificate is the consent — so
  // these are blank on a CDC job and every place that prints them leaves
  // the line out rather than showing an empty field.
  daNumber: string;
  daDate: string;
  d: JobDetails;
  issuedDate: string;
  applicantName: string;
};

// Single source of truth for the OC certificate package's content — used
// by both the on-screen page (app/certificate/oc/[jobId]/[ocId]/page.tsx)
// and the real .docx export (lib/docx/ocCertificate.ts).
// `client` overrides the request-scoped RLS client — see the portal
// certificate routes for why.
export async function getOcCertificateData(jobId: string, ocId: string, firmId: string, client?: SupabaseClient): Promise<OcCertificateData | null> {
  const supabase = client ?? (await createClient());

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", firmId).single();
  if (!rawJob) return null;
  const job = rawJob as Job;

  const [{ data: firm }, { data: allOcRecords }, { data: checklists }, { data: activePathwayVersion }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", firmId).single(),
    supabase.from("oc_records").select("*").eq("job_id", jobId).order("created_at"),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("cert_ref").eq("job_id", jobId).eq("version", job.pathway_version).maybeSingle(),
  ]);
  const record = (allOcRecords || []).find((r) => r.id === ocId) as OcRecord | undefined;
  if (!record) return null;
  const sequence = (allOcRecords || []).findIndex((r) => r.id === ocId) + 1;

  const issuedBy = record.issued_by ? ((await supabase.from("certifiers").select("*").eq("id", record.issued_by).single()).data as OcIssuer | null) : null;
  const signatureUrl = record.signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url, 3600, client) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url, 3600, client) : null;
  const uploadedApprovalUrl = record.approval_uploaded ? await signedUrl(record.approval_file_path, 3600, client) : null;

  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const allItems = ((ocChecklist?.checklist_items as never[]) || []) as OcChecklistItem[];
  const approvedItems = allItems.filter((i) => i.status === "approved");

  const ref = resolveOcCertRef(record.cert_ref, job.details?.projectNumber || job.id.slice(0, 8), sequence);
  const projRef = ref.split("/")[0];
  const typeLabel = record.type === "whole" ? "Whole Occupation Certificate" : "Partial Occupation Certificate";
  // What the occupation certificate is issued against: our own CDC/CC on
  // a full-service job, and the certificate another certifier issued on a
  // PC/OC one.
  const ownRef = job.pathway_generated
    ? resolvePathwayCertRef(activePathwayVersion?.cert_ref, job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version)
    : job.details?.projectNumber || "—";
  const approval = governingApproval(job.pathway, job.details?.priorApproval, ownRef);
  const consentRef = approval.ref;
  const consentLabel = approval.label;
  const d = job.details || {};
  const issuedDate = formatISODate(record.generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";

  const daNumber = (d.certificateDetails?.developmentConsentNumber || "").trim();
  const daDate = d.certificateDetails?.developmentConsentDate ? formatISODate(d.certificateDetails.developmentConsentDate) : "";

  return { job, firm: firm || null, record, issuedBy: issuedBy || null, approvedItems, signatureUrl, uploadedApprovalUrl, logoUrl, ref, projRef, typeLabel, consentRef, consentLabel, daNumber, daDate, d, issuedDate, applicantName };
}
