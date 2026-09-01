import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrl } from "@/lib/storage";
import { formatISODate, resolvePathwayCertRef, resolveOcCertRef, governingApproval } from "@/lib/business";
import type { Job, Firm, OcRecord, JobDetails } from "@/types/db";
import { loadCertificateTemplate } from "@/lib/certificates/loadTemplate";
import type { CertificateTemplate } from "@/lib/certificates/certificateTemplate";
import { loadFirmWording } from "@/lib/certificates/loadWording";
import { firmWording } from "@/lib/certificates/documentWording";

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
  // "Complying Development Certificate" / "Construction Certificate" —
  // the words {CONSENT} fills in with on rows and letters.
  consentFull: string;
  // The certificate's own heading and the line under it, composed once:
  // "OCCUPATION CERTIFICATE - WHOLE - CDC-26057/01 (RESIDENTIAL)".
  certTitle: string;
  certSubtitle: string;
  // The extra facts under "Re:" on both letters — a CDC names what it
  // was decided under, a CC names the development application.
  letterFacts: { label: string; value: string }[];
  // Clause 53 of the certification regulation, printed on a partial OC
  // and only a partial: the whole building's OC is owed within 5 years.
  partialConditions: { heading: string; clause: string; text: string } | null;
  // "I, <certifier>, as the certifying authority, certify that:" and
  // what follows it — the statutory declarations the signature sits
  // under, worded for this job's pathway and this certificate's type.
  determination: { heading: string; dateLabel: string; date: string; opening: string; bullets: string[] };
  scheduleHeading: string;
  // OC letters and certificates go out over the Principal Certifier's
  // title, not the generic "Registered Certifier" of the CDC/CC letters.
  signoffRole: string;
  // The layout this certificate is drawn from: the firm's own where they
  // have saved one, Certlyn's otherwise.
  template: CertificateTemplate;
  // The two letters, resolved once here.
  //
  // They used to be written out separately in the screen, the PDF and
  // the Word file — the same sentence three times, which is three places
  // to change and three chances for one to say something different from
  // the certificate travelling with it.
  councilBody: string[];
  applicantBody: string[];
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

  // What the occupation certificate is issued against: our own CDC/CC on
  // a full-service job, and the certificate another certifier issued on a
  // PC/OC one.
  const ownRef = job.pathway_generated
    ? resolvePathwayCertRef(activePathwayVersion?.cert_ref, job.pathway, job.details?.projectNumber || job.id.slice(0, 8), job.pathway_version)
    : job.details?.projectNumber || "—";
  const approval = governingApproval(job.pathway, job.details?.priorApproval, ownRef);
  const consentRef = approval.ref;
  const consentLabel = approval.label;
  const consentFull =
    consentLabel === "CDC" ? "Complying Development Certificate" : consentLabel === "CC" ? "Construction Certificate" : consentLabel || "Approval";
  const ref = resolveOcCertRef(record.cert_ref, job.pathway, job.pathway_generated ? ownRef : "", job.details?.projectNumber || job.id.slice(0, 8), sequence);
  const projRef = ref.split("/")[0];
  const typeLabel = record.type === "whole" ? "Whole Occupation Certificate" : "Partial Occupation Certificate";
  const d = job.details || {};
  const issuedDate = formatISODate(record.generated_date);
  const applicantName = [d.contact?.title, d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ") || d.contact?.nameOrCompany || "Applicant";

  const daNumber = (d.certificateDetails?.developmentConsentNumber || "").trim();
  const daDate = d.certificateDetails?.developmentConsentDate ? formatISODate(d.certificateDetails.developmentConsentDate) : "";

  // The heading, worked out the way the practice's own certificates put
  // it: the kind of OC, its number, and (RESIDENTIAL) when every class
  // on the job is a house or its outbuildings (class 1 and 10).
  const classes = d.proposal?.classifications || [];
  const residential = classes.length > 0 && classes.every((c) => /^(1|10)[a-c]?$/i.test(String(c).trim()));
  const certTitle = `OCCUPATION CERTIFICATE - ${record.type === "whole" ? "WHOLE" : "PARTIAL"} - ${ref}${residential ? " (RESIDENTIAL)" : ""}`;
  const certSubtitle = "Issued under Part 6 of the Environmental Planning and Assessment Act 1979";

  // Under "Re:" a CDC letter says what the decision was made under, a CC
  // letter names the development application the consent sits on.
  const decidedUnder = [d.certificateDetails?.relevantInstrument, d.certificateDetails?.relevantPartOfCode].filter(Boolean).join(" - ");
  const letterFacts: { label: string; value: string }[] = [];
  if (job.pathway === "CDC" && decidedUnder) letterFacts.push({ label: "Decision Made Under:", value: decidedUnder });
  if (job.pathway !== "CDC" && daNumber) letterFacts.push({ label: "Development Application No.:", value: daNumber });

  const partialConditions =
    record.type === "partial"
      ? {
          heading: "CONDITIONS OF OCCUPATION CERTIFICATE",
          clause: "53  Occupation certificates for partially completed buildings—the Act, s 6.33(1)",
          text: "It is a condition of an occupation certificate issued for the first completed stage of a partially completed building (the partial occupation certificate) that an occupation certificate must be obtained for the whole building within 5 years after the partial occupation certificate is issued.",
        }
      : null;

  const determination = {
    heading: "DETERMINATION",
    dateLabel: "Approval Date:",
    date: issuedDate,
    opening: `I, ${issuedBy?.name || "—"}, as the certifying authority, certify that:`,
    bullets: [
      "I have been appointed as the Principal Certifier under s6.5;",
      // On a partial, the occupants move in beside unfinished work — the
      // certifier declares that has been weighed, as the practice's own
      // partial OCs do.
      ...(record.type === "partial" ? ["The health and safety of the occupants of the building have been considered;"] : []),
      "A current Development Consent or Complying Development Certificate is in force with respect to the building;",
      `A ${consentFull} has been issued with respect to the plans and specifications for the building;`,
      "The building is suitable for occupation or use in accordance with its Classification under the Building Code of Australia;",
    ],
  };

  const scheduleHeading = `SCHEDULE 1: DOCUMENTATION REQUIRED TO ISSUE OCCUPATION CERTIFICATE ${ref}`;
  const signoffRole = "Principal Certifier";

  const { template } = await loadCertificateTemplate(supabase, firmId, "OC");

  // The firm's own wording where they have written some, Certlyn's
  // otherwise — the same three layers as the CDC and CC letters.
  const wording = await loadFirmWording(supabase, firmId);
  const wordingValues = {
    FIRM: firm?.name,
    CERTIFIER: issuedBy?.name,
    ADDRESS: job.address,
    PATHWAY: typeLabel,
    COUNCIL: d.council?.lga || "Council",
    APPLICANT: applicantName,
    CONSENT: consentFull,
    "CONSENT NO": consentRef,
    "DA NO": daNumber,
    "CERTIFICATE NO": ref,
    "FIRM ADDRESS": firm?.office_address,
  };

  // The letters as the practice writes them, taken sentence for
  // sentence from their issued OCs. The firm's own wording, where they
  // have saved some, still wins.
  const contactClose = `Should you need to discuss any issues, please do not hesitate to contact the Principal Certifier, ${issuedBy?.name || "our office"}, on the above numbers.`;
  const councilBody = firmWording(wording, "oc.council.body", wordingValues) ?? [
    `${firm?.name} has issued an Occupation Certificate for the above-mentioned project under Sections 6.9, 6.10 of the Environmental Planning and Assessment Act 1979.`,
    "Please find enclosed the following documentation:",
    `•  Occupation Certificate No. ${ref}
•  Documentation used to determine the Occupation Certificate`,
    contactClose,
  ];

  const applicantBody = firmWording(wording, "oc.applicant.body", wordingValues) ?? [
    `In accordance with Sections 6.9, 6.10 of the Environmental Planning and Assessment Act 1979, we enclose an Occupation Certificate relating to the construction of the above project.`,
    `As required under the legislation copies of the same have been forwarded to ${d.council?.lga || "Council"} for their records.`,
    // A partial is a certificate with a clock on it, and the client is
    // told so in the letter as well as on the certificate. A whole OC is
    // the end of the job, and says thank you instead.
    record.type === "partial"
      ? "It is a condition of an occupation certificate issued for the first completed stage of a partially completed building (the partial occupation certificate) that an occupation certificate must be obtained for the whole building within 5 years after the partial occupation certificate is issued. A fee will apply for an additional inspection, assessment and issuance of an additional Occupation Certificate."
      : "We would like to take this opportunity to thank you for using our services.",
    contactClose,
  ];

  return {
    template,
    job,
    firm: firm || null,
    record,
    issuedBy: issuedBy || null,
    approvedItems,
    signatureUrl,
    uploadedApprovalUrl,
    logoUrl,
    ref,
    projRef,
    typeLabel,
    consentRef,
    consentLabel,
    consentFull,
    daNumber,
    daDate,
    d,
    issuedDate,
    applicantName,
    certTitle,
    certSubtitle,
    letterFacts,
    partialConditions,
    determination,
    scheduleHeading,
    signoffRole,
    councilBody,
    applicantBody,
  };
}
