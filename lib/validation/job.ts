import type { JobDetails } from "@/types/db";

// What a job has to have before it can be created.
//
// The list is the information a CDC or CC certificate genuinely can't be
// produced without — every one of these prints on the certificate, the
// letters or the inspections notice. Creating a job without them meant
// discovering the gap later, at the point of issuing, with the applicant
// waiting.
//
// Shared by the New Job form and createJob, so what the form asks for and
// what the server insists on can't drift apart. The server runs it too:
// browser validation is a convenience, not a guarantee.

export type JobShape = {
  pathway: "CDC" | "CC";
  address: string;
  description: string;
  certifierId: string | null;
  details: JobDetails;
};

export function missingJobFields({ pathway, address, description, certifierId, details }: JobShape): string[] {
  const d = details;
  const missing: string[] = [];
  const need = (value: string | null | undefined, label: string) => {
    if (!String(value || "").trim()) missing.push(label);
  };

  need(address, "Property address");
  need(description, "Scope of works");
  need(d.certificateDetails?.lotSectionDp, "Lot / Section / Plan");
  need(d.council?.lga, "Council");
  if (!certifierId) missing.push("Assigned certifier");

  // Either a company name or a person's name will do — the certificate
  // prints whichever is given.
  const person = [d.contact?.givenNames, d.contact?.surname].filter(Boolean).join(" ").trim();
  if (!String(d.contact?.nameOrCompany || "").trim() && !person) missing.push("Applicant name");

  need(d.applicantAddress?.streetNumber, "Applicant street number");
  need(d.applicantAddress?.street, "Applicant street");
  need(d.applicantAddress?.suburb, "Applicant suburb");
  need(d.applicantAddress?.postcode, "Applicant postcode");

  need(d.bcaVersion, "BCA / NCC version");
  if ((d.proposal?.classifications || []).length === 0) missing.push("BCA classification");
  need(d.proposal?.estimatedCost, "Estimated cost of construction");

  // Land Use Zone prints on a CDC but not on a CC.
  if (pathway === "CDC") need(d.zoning, "Land zoning");

  // The owner's details print on the certificate, so they're needed
  // whenever they aren't simply the applicant's.
  if (!d.ownerSameAsApplicant) {
    need(d.owner?.name, "Owner name");
    need(d.owner?.address?.street, "Owner street");
    need(d.owner?.address?.suburb, "Owner suburb");
  }

  return missing;
}

export function missingFieldsMessage(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Before this project can be created, please fill in: ${missing.join(", ")}.`;
}
