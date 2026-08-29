import { formatAddress, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatISODate } from "@/lib/business";
import type { FieldValues } from "@/lib/certificates/templateFields";

// What every row on a certificate can say, worked out once.
//
// The PDF, the Word export and the on-screen copy all print the same
// certificate and each used to compute these for itself — which is how
// the same job came out three slightly different ways. They read from
// here now, so a row can only differ between them if the template does.

export function certificateFieldValues(data: PathwayCertificateData): FieldValues {
  const { job, issuedBy, lapseDate, ref, d, cd, issuedDate, applicantName, applicantPhone, ownerName, ownerAddress, ownerPhone, docOverrides } = data;

  // A value the certifier corrected on the certificate itself wins over
  // the generated one, so the approved set says what the screen says.
  const ov = (key: string, value?: string | null) => (docOverrides || {})[`cert.${key}`] ?? value ?? "";

  return {
    applicant: ov("applicant", applicantName),
    applicantAddress: ov("applicantAddress", formatAddress(d.applicantAddress)),
    applicantPhone: ov("applicantPhone", applicantPhone),
    owner: ov("owner", ownerName),
    ownerAddress: ov("ownerAddress", ownerAddress),
    ownerPhone: ov("ownerPhone", ownerPhone),
    planningPortalRef: cd.planningPortalRef || "",
    lga: d.council?.lga || "",
    epi: ov("epi", cd.relevantInstrument),
    partOfCode: ov("partOfCode", cd.relevantPartOfCode),
    determinationDate: formatISODate(cd.determinationDate),
    // A lapse date can be a sentence rather than a date — a CDC that has
    // been acted upon has none — so only a real date is formatted.
    lapseDate: /^\d{4}-\d{2}-\d{2}$/.test(lapseDate) ? formatISODate(lapseDate) : lapseDate,
    developmentConsentNumber: cd.developmentConsentNumber || "",
    developmentConsentDate: formatISODate(cd.developmentConsentDate),
    certificateNumber: ref,
    issuedDate,
    devAddress: ov("devAddress", job.address),
    lotDp: ov("lotDp", cd.lotSectionDp),
    zone: ov("zone", d.zoning),
    bcaClass: ov("bcaClass", formatClassifications(d.proposal?.classifications)),
    bcaVersion: ov("bcaVersion", formatBcaVersion(d.bcaVersion, d.bcaVolumes)),
    description: ov("description", job.description),
    value: ov("value", formatCurrency(d.proposal?.estimatedCost)),
    attachments: ov("attachments", "Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon"),
    inspections: ov("inspections", "See attached Notice"),
    certifierName: ov("certifierName", issuedBy?.name),
    registrationBody: ov("registrationBody", issuedBy?.registration_body),
    registrationNo: ov("registrationNo", issuedBy?.registration_no),
  };
}

// The conditions row prints as paragraphs rather than one value, and both
// renderers build them the same way: the certifier's own wording if they
// have written any, otherwise the standard two paragraphs followed by
// whatever conditions the job carries.
export type ConditionParagraph = { text: string; bulleted: boolean };

export function conditionParagraphs(data: PathwayCertificateData): ConditionParagraph[] {
  const written = (data.docOverrides || {})["cert.conditions"];
  if (written) {
    // Wording the certifier typed themselves is prose exactly as they
    // typed it — bulleting it would be the app editing their conditions.
    return written
      .split("\n\n")
      .map((para) => para.trim())
      .filter(Boolean)
      .map((text) => ({ text, bulleted: false }));
  }
  return [
    {
      text: "Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021",
      bulleted: false,
    },
    {
      text: "Any monetary contribution fee’s and/or any other Council fee’s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.",
      bulleted: false,
    },
    // The job's own conditions are a list, and read as one.
    ...data.conditions.map((c) => ({ text: c.text, bulleted: true })),
  ];
}
