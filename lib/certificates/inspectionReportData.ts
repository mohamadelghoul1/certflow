import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { resolvePathwayCertRef } from "@/lib/business";
import { letterheadFor, type Letterhead } from "@/lib/letterhead";
import type { Job, Firm, Defect, InspectionPhoto, Certifier, JobDetails } from "@/types/db";

export type InspectionRecord = {
  id: string;
  title: string;
  date: string | null;
  outcome: string;
  inspector_certifier_id: string | null;
  report_signed_at: string | null;
  // The signed report as a stored file, so a download does not rebuild
  // something that cannot have changed. Added by migration 0027.
  report_pdf_path?: string | null;
  report_intro_override: string | null;
  report_notes: string | null;
  defects: Defect[];
  inspection_photos: InspectionPhoto[];
};

export type InspectionReportData = {
  job: Job;
  // Whose letterhead the report goes out on: the firm's, or the
  // inspector's own practice where they are a contractor certifier
  // working under their own registration. Named `firm` because that is
  // what every letterhead component takes.
  firm: Letterhead | null;
  inspection: InspectionRecord;
  inspector: Certifier | null;
  signatureUrl: string | null;
  logoUrl: string | null;
  photoUrls: (string | null)[];
  d: JobDetails;
  applicantName: string;
  certRef: string;
  certNumbers: string;
  certTypeLabel: string;
  consentRefLines: string[];
  introText: string;
  notes: string;
};

// Single source of truth for the inspection report's content — used by
// both the on-screen page
// (app/jobs/[jobId]/inspections/[inspectionId]/report/page.tsx) and the
// real .docx export (lib/docx/inspectionReport.ts).
export async function getInspectionReportData(jobId: string, inspectionId: string, firmId: string): Promise<InspectionReportData | null> {
  const supabase = await createClient();

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", firmId).single();
  if (!rawJob) return null;
  const job = rawJob as Job;

  const [{ data: rawInspection }, { data: firm }, { data: versions }, { data: certifiers }] = await Promise.all([
    supabase.from("inspections").select("*, defects(*), inspection_photos(*)").eq("id", inspectionId).eq("job_id", jobId).single(),
    supabase.from("firms").select("*").eq("id", firmId).single(),
    supabase.from("pathway_certificate_versions").select("version, cert_ref").eq("job_id", jobId).order("version"),
    // The firm's certifiers, fetched alongside rather than looking up the
    // one inspector afterwards: a firm has a handful of them, and that
    // lookup was a round trip of its own that everything else waited on.
    supabase.from("certifiers").select("*").eq("firm_id", firmId),
  ]);
  if (!rawInspection) return null;
  const inspection = rawInspection as InspectionRecord;

  const inspector = ((certifiers || []) as Certifier[]).find((c) => c.id === inspection.inspector_certifier_id) || null;

  // Every signed link at once. Run one after another — the signature,
  // then the logo, then each photo in turn — a report with a dozen photos
  // spent most of its time waiting on round trips that have nothing to do
  // with each other.
  // A contract certifier's inspection goes out on their own letterhead,
  // an employee's on the firm's.
  const { letterhead, logoUrl: letterheadLogo } = letterheadFor(inspector, (firm || null) as Firm | null);

  const [signatureUrl, logoUrl, photoUrls] = await Promise.all([
    inspection.report_signed_at && inspector?.signature_url ? signedUrl(inspector.signature_url) : null,
    letterheadLogo ? signedUrl(letterheadLogo) : null,
    Promise.all(inspection.inspection_photos.map((p) => signedUrl(p.file_path))),
  ]);

  const d = job.details || {};
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "—";
  const activeVersion = (versions || []).find((v) => v.version === job.pathway_version);
  const certRef = job.pathway_generated ? resolvePathwayCertRef(activeVersion?.cert_ref, job.pathway, d.projectNumber || job.id.slice(0, 8), job.pathway_version) : d.projectNumber || job.id.slice(0, 8).toUpperCase();

  // The certificate the inspection was carried out under. A CDC or CC job
  // names its own certificate; a PC/OC job issues none, so it names the
  // approval the other certifier issued — recorded on the Details tab —
  // and the label follows that certificate's type, not the job's.
  const prior = d.priorApproval;
  const certNumbers =
    job.pathway === "PC_OC"
      ? prior?.number || ""
      : (versions || []).map((v) => resolvePathwayCertRef(v.cert_ref, job.pathway, d.projectNumber || job.id.slice(0, 8), v.version)).join(", ");
  const certTypeLabel = (job.pathway === "PC_OC" ? prior?.type || "CDC" : job.pathway) === "CDC" ? "Complying Development Certificate" : "Construction Certificate";
  const consentRefLines = (d.certificateDetails?.consentReferences || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // The certifier can replace the standard opening paragraph; blank or
  // absent keeps the default wording.
  const introText =
    inspection.report_intro_override?.trim() ||
    "We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required.";
  const notes = inspection.report_notes?.trim() || "";

  return { job, firm: letterhead, inspection, inspector: inspector || null, signatureUrl, logoUrl, photoUrls, d, applicantName, certRef, certNumbers, certTypeLabel, consentRefLines, introText, notes };
}
