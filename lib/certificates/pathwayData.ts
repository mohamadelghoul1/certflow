import { createClient } from "@/lib/supabase/server";
import { loadFirmWording } from "@/lib/certificates/loadWording";
import { firmWording } from "@/lib/certificates/documentWording";
import { scheduleRows } from "@/lib/checklistDocuments";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrl } from "@/lib/storage";
import { formatISODate, resolvePathwayCertRef, calcCdcLapseDate } from "@/lib/business";
import type { Job, Firm, Certifier, ConditionOfConsent, CriticalStageInspection, JobDetails, ChecklistItemFile } from "@/types/db";
import { loadCertificateTemplate } from "@/lib/certificates/loadTemplate";
import type { CertificateTemplate } from "@/lib/certificates/certificateTemplate";

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
// The NCC version and the volumes assessed against it are one line on the
// certificate — a job can be assessed under more than one volume (a
// dwelling plus a Class 10 shed, say), so they're ticked separately but
// read together.
export function formatBcaVersion(version?: string | null, volumes?: string[] | null) {
  const vols = (volumes || []).filter(Boolean);
  if (!version) return vols.length ? vols.join(", ") : "";
  return vols.length ? `${version} — ${vols.join(", ")}` : version;
}

export function formatCurrency(value?: string | null) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : value;
}

// The sentence the letters carry about why a certificate was modified,
// built from the reason typed when the modification was started.
// "changes to the floor plan layout and window schedule" becomes "This
// modification reflects changes to the floor plan layout and window
// schedule." A reason already written as that sentence is kept as
// typed, and the leading letter is only lowered when it starts an
// ordinary word — "BASIX" stays "BASIX".
export function modificationReasonSentence(reason: string | null | undefined): string | null {
  const r = (reason || "").trim();
  if (!r) return null;
  const period = r.endsWith(".") ? "" : ".";
  if (/^this modification/i.test(r)) return r + period;
  const lead = r.length > 1 && /[A-Z]/.test(r[0]) && r[1] === r[1].toLowerCase() ? r[0].toLowerCase() + r.slice(1) : r;
  return `This modification reflects ${lead}${period}`;
}

export type PathwayCertificateData = {
  job: Job;
  firm: Firm | null;
  issuedBy: Certifier | null;
  conditions: ConditionOfConsent[];
  // One entry per document, not per checklist item: an item satisfied by
  // two certificates contributes two rows to Schedule 1, each with its
  // own preparer, reference and date.
  allItems: { id: string; title: string; status: string; document_date: string | null; prepared_by: string | null; drawing_number: string | null; revision: string | null }[];
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
  // A version beyond the first is a modified certificate — issued under
  // section 4.30 for a CDC — and the letters say so: in the reference
  // line above the body, and in a sentence carrying the reason typed
  // when the modification was started (null when none was given).
  isModification: boolean;
  modificationReason: string | null;
  councilCertLabel: string;
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
  // The Section 58 paragraph above Schedule 1, resolved once so the PDF
  // and the Word file cannot disagree about what notice was given.
  inspectionsNotice: string[];
  requiredDocsList: string[];
  // Per-job wording overrides, and the letter lines with them applied.
  docOverrides: Record<string, string>;
  applicantSalutation: string;
  councilSalutation: string;
  applicantIntro: string;
  applicantRequirementsIntro: string;
  applicantClosing: string;
  // The layout this certificate is drawn from: the firm's own where they
  // have saved one, Certlyn's otherwise. Loaded here so the PDF, the
  // Word export and the on-screen copy all draw the same certificate.
  template: CertificateTemplate;
  templateProblems: string[];
};

// Single source of truth for the CDC/CC certificate package's content —
// used by both the on-screen page (app/certificate/pathway/[jobId]/page.tsx)
// and the real .docx export (lib/docx/pathwayCertificate.ts), so the two
// can never drift apart the way a duplicated copy of this logic would.
// `client` overrides the request-scoped RLS client — see the portal
// certificate routes for why.
export async function getPathwayCertificateData(jobId: string, firmId: string, client?: SupabaseClient): Promise<PathwayCertificateData | null> {
  const supabase = client ?? (await createClient());

  const { data: rawJob } = await supabase.from("jobs").select("*").eq("id", jobId).eq("firm_id", firmId).single();
  if (!rawJob || !rawJob.pathway_generated) return null;
  const job = rawJob as Job;

  const [{ data: firm }, { data: conditions }, { data: issuedBy }, { data: checklists }, { data: inspections }, { data: activeVersion }, { data: modifications }] = await Promise.all([
    supabase.from("firms").select("*").eq("id", firmId).single(),
    supabase.from("conditions_of_consent").select("*").eq("job_id", jobId).order("created_at"),
    job.pathway_issued_by ? supabase.from("certifiers").select("*").eq("id", job.pathway_issued_by).single() : Promise.resolve({ data: null }),
    supabase
      .from("checklists")
      // The files too: an item can hold more than one document, and
      // Schedule 1 lists each of them with its own details.
      .select("id, kind, checklist_items(*, checklist_item_files(*))")
      .eq("job_id", jobId)
      .order("sort_order", { referencedTable: "checklist_items" })
      .order("created_at", { referencedTable: "checklist_items" }),
    supabase.from("inspections").select("outcome").eq("job_id", jobId),
    supabase.from("pathway_certificate_versions").select("id, cert_ref").eq("job_id", jobId).eq("version", job.pathway_version).single(),
    // Only a re-issued certificate needs the modification's reason.
    job.pathway_version > 1
      ? supabase.from("modifications").select("reason, generated").eq("job_id", jobId).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);
  const signatureUrl = job.pathway_signed_at && issuedBy?.signature_url ? await signedUrl(issuedBy.signature_url, 3600, client) : null;
  const uploadedApprovalUrl = job.pathway_approval_uploaded ? await signedUrl(job.pathway_approval_file_path, 3600, client) : null;
  const logoUrl = firm?.logo_url ? await signedUrl(firm.logo_url, 3600, client) : null;

  const pathwayChecklist = (checklists || []).find((c) => c.kind === "pathway");
  const nocChecklist = (checklists || []).find((c) => c.kind === "noc");
  // Schedule 1 lists what the certificate relies on, so a document the
  // certifier has left out of the approval is left out here too. The
  // column is undefined until migration 0020 has been run, which counts
  // as included.
  const includedItems = (((pathwayChecklist?.checklist_items as never[]) || []) as {
    id: string;
    title: string;
    status: string;
    include_in_approval?: boolean;
    document_date: string | null;
    prepared_by: string | null;
    // Stored as drawing_number, but it holds any document reference —
    // a BASIX certificate number as readily as a drawing number.
    drawing_number: string | null;
    revision: string | null;
    file_path?: string | null;
    checklist_item_files?: ChecklistItemFile[] | null;
  }[]).filter((i) => i.include_in_approval !== false);

  // Expanded document by document, so an item satisfied by two
  // certificates is two rows on Schedule 1 rather than one.
  const allItems = scheduleRows(includedItems);

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

  // The firm's own wording, if they have written any. Empty for a firm
  // that has not, and for a database that has not run migration 0064.
  const wording = await loadFirmWording(supabase, firmId);

  // What this job says, then what this firm says, then what Certlyn
  // says. A firm that has written nothing falls through to the third,
  // which is the same text it has always been.
  const wordingValues = {
    FIRM: firm?.name,
    CERTIFIER: issuedBy?.name,
    ADDRESS: job.address,
    PATHWAY: pathwayFull,
    COUNCIL: d.council?.lga || "Council",
    APPLICANT: applicantName,
    "CERTIFICATE NO": ref,
    "FIRM ADDRESS": firm?.office_address,
  };

  // The Section 58 paragraph above Schedule 1. Written out in the PDF
  // and in the Word file before this, which is two places for a firm's
  // own wording to reach and one of them to be forgotten.
  const inspectionsNotice = firmWording(wording, "inspections.notice", wordingValues) ?? [
    `I, ${issuedBy?.name || "—"} of ${firm?.name || ""}, located at ${firm?.office_address || "—"}, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.`,
  ];

  // A certificate version beyond the first is a modification. The
  // letters name it as one — issued under section 4.30 for a CDC — and
  // carry the reason typed when the modification was started, preferring
  // the one that has actually been issued when several exist.
  const isModification = job.pathway_version > 1;
  const mods = ((modifications || []) as { reason: string | null; generated: boolean }[]);
  const latestMod = mods.find((m) => m.generated) || mods[0];
  const modificationReason = isModification ? modificationReasonSentence(latestMod?.reason) : null;
  const councilCertLabel = isModification
    ? isCdc
      ? `Section 4.30 Modification – ${pathwayFull} No.:`
      : `Modified ${pathwayFull} No.:`
    : `${pathwayFull} No.:`;

  const councilBody = job.council_letter_override
    ? job.council_letter_override.split("\n\n")
    : firmWording(wording, "council.body", wordingValues) ??
      (isModification
        ? // The modification letter is the approval letter with the work
          // already under way: it says the certificate is a modified one
          // and why, and drops the notice-of-intention reminder that only
          // belongs before works commence.
          [
            `${firm?.name} has issued a Modified ${pathwayFull} under ${isCdc ? "Part 4" : "Sections 6.3, 6.4, 6.16"} of the Environmental Planning and Assessment Act 1979 for the above premises.`,
            ...(modificationReason ? [modificationReason] : []),
            `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuedBy?.name || "—"}.`,
          ]
        : [
            `${firm?.name} has issued a ${pathwayFull} under ${isCdc ? "Part 4" : "Sections 6.3, 6.4, 6.16"} of the Environmental Planning and Assessment Act 1979 for the above premises.`,
            ...(isCdc ? ["The applicant / owner has been advised to submit the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site."] : []),
            `Should you need to discuss any issues, please do not hesitate to contact the Registered Building Surveyor ${issuedBy?.name || "—"}.`,
          ]);

  const applicantBody = job.applicant_letter_override
    ? job.applicant_letter_override.split("\n\n")
    : firmWording(wording, "applicant.body", wordingValues) ?? [
        `One copy of each has been forwarded directly to ${d.council?.lga || "Council"} for their records.`,
        `The Applicant / Owner is required to lodge the Appointment of a Principal Certifier to us through the NSW Planning Portal.`,
        ...(isCdc ? [`Please note that no works can commence on site less than 7 days from the date of issuance of ${job.pathway}.`] : []),
        `Once our office accepts the Principal Certifier Appointment through the NSW Planning Portal the Applicant / Owner is required to lodge the Notice of Intention to commence works on the NSW Planning Portal at least 48 hours prior to any works commencing on site.`,
        `The Principal Certifier role to be undertaken by ${issuedBy?.name || "—"} will require inspections and certification.`,
        `Please have the Owner/Builder or licensed contractor liaise with ${issuedBy?.name || "—"} prior to commencement of the work.`,
        `Should you need to discuss any issues, please do not hesitate to contact the undersigned on the above numbers.`,
      ];

  // Wording this job overrides, resolved once here so the screen, the
  // Word export and the approved-set PDF cannot disagree about what the
  // letter says.
  const docOverrides = (d.docOverrides || {}) as Record<string, string>;
  const applicantSalutation = docOverrides["applicant.salutation"] || "Dear Sir/Madam,";
  const councilSalutation = docOverrides["council.salutation"] || "Dear Sir/Madam,";
  const applicantIntro =
    docOverrides["applicant.intro"] || `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`;
  const applicantRequirementsIntro =
    docOverrides["applicant.requirementsIntro"] ||
    "Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:";
  const applicantClosing = docOverrides["applicant.closing"] || "Yours sincerely,";

  const standardRequiredDocs = isCdc
    ? ["Receipt of the Council Contribution Fee.", "Receipt of the Council Bond.", "Builder’s Home Building Compensation Fund (HBCF Certificate) or Owner Builder Permit.", "Erosion and Sediment Controls to be implemented on site.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."]
    : ["Erosion and Sediment Controls to be installed on site.", "Builder’s Home Warranty Certificate (HBCF) or Owner Builder Permit.", "Lodge the Principal Certifier Appointment to us through the NSW Planning Portal."];

  const requiredDocsList = docOverrides["applicant.requirements"]
    ? docOverrides["applicant.requirements"].split("\n").map((line) => line.trim()).filter(Boolean)
    : standardRequiredDocs;

  // The firm's own layout where they have saved one, ours otherwise.
  const { template, problems } = await loadCertificateTemplate(supabase, firmId, job.pathway);

  return {
    template,
    templateProblems: problems,
    inspectionsNotice,
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
    isModification,
    modificationReason,
    councilCertLabel,
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
    docOverrides,
    applicantSalutation,
    councilSalutation,
    applicantIntro,
    applicantRequirementsIntro,
    applicantClosing,
  };
}
