import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { formatISODate, pathwayCertRef, ocCertRef } from "@/lib/business";
import type { Job, Firm, OcRecord, JobDetails } from "@/types/db";

type OcChecklistItem = { id: string; title: string; status: string; revision: string | null; document_date: string | null; prepared_by: string | null };
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
  d: JobDetails;
  issuedDate: string;
  applicantName: string;
};

// Single source of truth for the OC certificate package's content — used
// by both the on-screen page (app/certificate/oc/[jobId]/[ocId]/page.tsx)
// and the real .docx export (lib/docx/ocCertificate.ts).
export async function getOcCertificateData(jobId: string, ocId: string, firmId: string): Promise<OcCertificateData | null> {
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", firmId).single();
  if (!rawJob) return null;
  const job = rawJob as Job;

  const [{ data: firm }, { data: allOcRecords }, { data: checklists }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", firmId).single(),
    supabase.from("oc_records").select("*").eq("job_id", jobId).order("created_at"),
    supabase.from("checklists").select("id, kind, checklist_items(*)").eq("job_id", jobId),
  ]);
  const record = (allOcRecords || []).find((r) => r.id === ocId) as OcRecord | undefined;
  if (!record) return null;
  const sequence = (allOcRecords || []).findIndex((r) => r.id === ocId) + 1;

  const issuedBy = record.issued_by ? ((await supabase.from("certifiers").select("*").eq("id", record.issued_by).single()).data as OcIssuer | null) : null;
  const signatureUrl = record.signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url) : null;
  const uploadedApprovalUrl = record.approval_uploaded ? await signedUrl(record.approval_file_path) : null;

  const ocChecklist = (checklists || []).find((c) => c.kind === "oc");
  const allItems = ((ocChecklist?.checklist_items as never[]) || []) as OcChecklistItem[];
  const approvedItems = allItems.filter((i) => i.status === "approved");

  const ref = ocCertRef(job.details?.projectNumber || job.id.slice(0, 8), sequence);
  const projRef = ref.split("/")[0];
  const typeLabel = record.type === "whole" ? "Whole Occupation Certificate" : "Partial Occupation Certificate";
  const consentRef = job.pathway_generated ? pathwayCertRef(job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version) : job.details?.projectNumber || "—";
  const d = job.details || {};
  const issuedDate = formatISODate(record.generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";

  return { job, firm: firm || null, record, issuedBy: issuedBy || null, approvedItems, signatureUrl, uploadedApprovalUrl, logoUrl, ref, projRef, typeLabel, consentRef, d, issuedDate, applicantName };
}
