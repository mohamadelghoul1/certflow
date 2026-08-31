import { csvRow } from "@/lib/csv";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobDetails } from "@/types/db";
import { formatClassifications, resolvePathwayCertRef, resolveOcCertRef, type Pathway } from "@/lib/business";

// The certificate issuance register: every CDC, CC and OC the firm
// issued inside a chosen period, with the details an auditor or insurer
// asks for, in one table.
//
// Built from the certificates themselves — the pathway certificate
// versions and OC records — rather than from the jobs, because a job
// re-issued twice holds two certificates and a register that showed one
// row would be short a certificate. Everything else on the row comes
// from the job's recorded details at the moment the register is drawn.

export type RegisterRow = {
  date: string;
  certType: "CDC" | "CC" | "OC";
  certNumber: string;
  portalRef: string;
  address: string;
  certifierName: string;
  classification: string;
  lotSectionDp: string;
  council: string;
  estimatedCost: string;
  applicantName: string;
  ownerName: string;
  principalContractor: string;
  description: string;
};

type JobRow = {
  id: string;
  address: string;
  description: string | null;
  pathway: Pathway;
  details: JobDetails | null;
};

function applicantNameOf(d: JobDetails | null): string {
  const person = [d?.contact?.givenNames, d?.contact?.surname].filter(Boolean).join(" ").trim();
  return d?.contact?.nameOrCompany?.trim() || person;
}

// The case inspections and certificates are filed under on the Portal —
// the application's own reference first, the inspection case where that
// is all the job carries (imported jobs, PC/OC appointments).
function portalRefOf(d: JobDetails | null): string {
  return d?.certificateDetails?.planningPortalRef?.trim() || d?.inspectionPortalCase?.trim() || d?.priorApproval?.portalRef?.trim() || "";
}

// "Company — Name (Lic. 12345C)", from whichever parts the job holds;
// older jobs and imports carry only the one-line field.
function contractorLine(d: JobDetails | null): string {
  const c = d?.contractor;
  const base = [c?.company, c?.name].filter(Boolean).join(" — ") || d?.principalContractor || "";
  return c?.licenceNo && base ? `${base} (Lic. ${c.licenceNo})` : base;
}

function rowFromJob(job: JobRow, certifierName: string): Omit<RegisterRow, "date" | "certType" | "certNumber"> {
  const d = job.details;
  return {
    portalRef: portalRefOf(d),
    address: job.address,
    certifierName,
    classification: formatClassifications(d?.proposal?.classifications),
    lotSectionDp: d?.certificateDetails?.lotSectionDp || "",
    council: d?.council?.lga || "",
    estimatedCost: d?.proposal?.estimatedCost || "",
    applicantName: applicantNameOf(d),
    ownerName: d?.ownerSameAsApplicant === false && d?.owner?.name?.trim() ? d.owner.name.trim() : applicantNameOf(d),
    principalContractor: contractorLine(d),
    description: job.description || "",
  };
}

export async function getIssuanceRegister(supabase: SupabaseClient, firmId: string, fromIso: string, toIso: string): Promise<RegisterRow[]> {
  const [{ data: certifiers }, { data: versions }, { data: ocRecords }] = await Promise.all([
    supabase.from("certifiers").select("id, name").eq("firm_id", firmId),
    supabase
      .from("pathway_certificate_versions")
      .select("version, generated_date, approval_date, issued_by, cert_ref, jobs!inner(id, firm_id, deleted_at, address, description, pathway, details)")
      .eq("jobs.firm_id", firmId)
      .is("jobs.deleted_at", null),
    supabase
      .from("oc_records")
      .select("id, type, generated_date, approval_date, issued_by, cert_ref, created_at, jobs!inner(id, firm_id, deleted_at, address, description, pathway, details)")
      .eq("jobs.firm_id", firmId)
      .is("jobs.deleted_at", null),
  ]);

  const certifierName = new Map((certifiers || []).map((c) => [c.id as string, c.name as string]));
  const inRange = (date: string | null) => !!date && date >= fromIso && date <= toIso;
  const rows: RegisterRow[] = [];

  for (const v of versions || []) {
    // A certificate is issued on its approval date; the generated date
    // stands in for records from before approvals carried their own.
    const date = (v.approval_date as string | null) || (v.generated_date as string | null);
    if (!inRange(date)) continue;
    const job = v.jobs as unknown as JobRow;
    if (job.pathway !== "CDC" && job.pathway !== "CC") continue;
    const projectRef = job.details?.projectNumber || job.id.slice(0, 8);
    rows.push({
      date: date!,
      certType: job.pathway,
      certNumber: resolvePathwayCertRef(v.cert_ref as string | null, job.pathway, projectRef, (v.version as number) || 1),
      ...rowFromJob(job, certifierName.get(v.issued_by as string) || ""),
    });
  }

  // An OC's printed number carries its 1-based position among every OC
  // on the job, so the positions are worked out across all of a job's
  // OCs before the date filter narrows them.
  const ocsByJob = new Map<string, { created_at: string; id: string }[]>();
  for (const r of ocRecords || []) {
    const job = r.jobs as unknown as JobRow;
    const group = ocsByJob.get(job.id) || [];
    group.push({ created_at: r.created_at as string, id: r.id as string });
    ocsByJob.set(job.id, group);
  }
  for (const group of ocsByJob.values()) group.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  for (const r of ocRecords || []) {
    const date = (r.approval_date as string | null) || (r.generated_date as string | null);
    if (!inRange(date)) continue;
    const job = r.jobs as unknown as JobRow;
    const sequence = (ocsByJob.get(job.id) || []).findIndex((oc) => oc.id === r.id) + 1;
    const projectRef = job.details?.projectNumber || job.id.slice(0, 8);
    rows.push({
      date: date!,
      certType: "OC",
      certNumber: resolveOcCertRef(r.cert_ref as string | null, projectRef, sequence || 1),
      ...rowFromJob(job, certifierName.get(r.issued_by as string) || ""),
    });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

export const REGISTER_COLUMNS: { key: keyof RegisterRow; label: string }[] = [
  { key: "date", label: "Date issued" },
  { key: "certType", label: "Type" },
  { key: "certNumber", label: "Certificate no." },
  { key: "portalRef", label: "Portal CDC/CFT no." },
  { key: "address", label: "Project address" },
  { key: "certifierName", label: "Certifier" },
  { key: "classification", label: "BCA classification" },
  { key: "lotSectionDp", label: "Lot / DP" },
  { key: "council", label: "Local council" },
  { key: "estimatedCost", label: "Cost of project" },
  { key: "applicantName", label: "Applicant" },
  { key: "ownerName", label: "Owner" },
  { key: "principalContractor", label: "Principal contractor" },
  { key: "description", label: "Project detail" },
];

// A field with a comma, a quote or a line break must arrive in Excel as
// one cell, not three — and one that starts like a formula must arrive
// as text rather than being run. See lib/csv.
export function registerCsv(rows: RegisterRow[]): string {
  const lines = [csvRow(REGISTER_COLUMNS.map((c) => c.label))];
  for (const row of rows) lines.push(csvRow(REGISTER_COLUMNS.map((c) => row[c.key] ?? "")));
  return lines.join("\r\n");
}

// The default period: the current Australian financial year, which is
// what an insurer's or Fair Trading's request almost always means.
export function financialYearStart(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  return todayIso >= `${year}-07-01` ? `${year}-07-01` : `${year - 1}-07-01`;
}
