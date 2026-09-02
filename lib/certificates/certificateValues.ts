import { formatAddress, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatISODate } from "@/lib/business";
import type { FieldValues } from "@/lib/certificates/templateFields";
import { DOC_KEYS } from "@/lib/certificates/docKeys";
import type { OcCertificateData } from "@/lib/certificates/ocData";

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

  // Nine rows on the certificate screen were saved under a key of their
  // own that no document ever read: a certifier could correct the date of
  // determination, the lapse date, the Portal reference or any of the
  // consent fields, watch the screen change, and hand over a PDF still
  // carrying the original. The screen's keys are honoured here rather
  // than renamed, so every correction already typed on a live job now
  // reaches the document instead of being thrown away.
  //
  // An override is taken exactly as typed. These rows display a
  // formatted date, so the correction is already the words the certifier
  // wants on the page and formatting it again would rewrite them.
  const from = (keys: string[], value?: string | null) => {
    for (const key of keys) {
      const written = (docOverrides || {})[key];
      if (written !== undefined) return written;
    }
    return value ?? "";
  };

  return {
    applicant: ov("applicant", applicantName),
    applicantAddress: ov("applicantAddress", formatAddress(d.applicantAddress)),
    applicantPhone: ov("applicantPhone", applicantPhone),
    owner: ov("owner", ownerName),
    ownerAddress: ov("ownerAddress", ownerAddress),
    ownerPhone: ov("ownerPhone", ownerPhone),
    planningPortalRef: from(DOC_KEYS.planningPortalRef, cd.planningPortalRef),
    lga: from(DOC_KEYS.lga, d.council?.lga),
    epi: ov("epi", cd.relevantInstrument),
    partOfCode: ov("partOfCode", cd.relevantPartOfCode),
    determinationDate: from(DOC_KEYS.determinationDate, formatISODate(cd.determinationDate)),
    // A lapse date can be a sentence rather than a date — a CDC that has
    // been acted upon has none — so only a real date is formatted.
    lapseDate: from(DOC_KEYS.lapseDate, /^\d{4}-\d{2}-\d{2}$/.test(lapseDate) ? formatISODate(lapseDate) : lapseDate),
    developmentConsentNumber: from(DOC_KEYS.developmentConsentNumber, cd.developmentConsentNumber),
    developmentConsentDate: from(DOC_KEYS.developmentConsentDate, formatISODate(cd.developmentConsentDate)),
    certificateNumber: from(DOC_KEYS.certificateNumber, ref),
    issuedDate: from(DOC_KEYS.issuedDate, issuedDate),
    devAddress: ov("devAddress", job.address),
    lotDp: ov("lotDp", cd.lotSectionDp),
    zone: ov("zone", d.zoning),
    bcaClass: ov("bcaClass", formatClassifications(d.proposal?.classifications)),
    bcaVersion: ov("bcaVersion", formatBcaVersion(d.bcaVersion, d.bcaVolumes)),
    // A modified certificate's description carries the modification on
    // its own line under the works — "Section 4.30 Modification – This
    // modification reflects …" — so the row says both what is approved
    // and what changed. A correction typed on the certificate replaces
    // the whole row, modification line included, as any override does.
    description: ov(
      "description",
      [job.description, data.modificationLabel && (data.modificationReason ? `${data.modificationLabel} – ${data.modificationReason}` : data.modificationLabel)]
        .filter(Boolean)
        .join("\n")
    ),
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
  // The standard sets this development was approved subject to, named on
  // the certificate as well as attached behind it: a reader holding only
  // the certificate can still see which conditions apply. CDC only.
  const attached = (data.job.pathway === "CDC" ? data.d.cdcConditions || [] : []).filter((c) => c.name?.trim());

  return [
    {
      text: "Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021",
      bulleted: false,
    },
    ...(attached.length > 0
      ? [{ text: `This certificate is issued subject to the following conditions, attached to this approval:`, bulleted: false }, ...attached.map((c) => ({ text: c.name, bulleted: true }))]
      : []),
    {
      text: "Any monetary contribution fee’s and/or any other Council fee’s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.",
      bulleted: false,
    },
    // The job's own conditions are a list, and read as one.
    ...data.conditions.map((c) => ({ text: c.text, bulleted: true })),
  ];
}

// The same idea for an Occupation Certificate, which names the approval
// it was issued against rather than the consents behind an approval it
// is granting.
export function ocFieldValues(data: OcCertificateData): FieldValues {
  const d = data.d;
  const applicantPhone = d.contact?.phone || d.contact?.mobile || "";
  // The person having the benefit of the consent — the applicant unless
  // an owner is recorded separately, same rule the CDC and CC use.
  const ownerName = d.ownerSameAsApplicant ? data.applicantName : d.owner?.name || data.applicantName;
  const ownerAddress = d.ownerSameAsApplicant ? formatAddress(d.applicantAddress) : formatAddress(d.owner?.address);
  const ownerPhone = (d.ownerSameAsApplicant ? applicantPhone : d.owner?.phone) || "";
  const cd = d.certificateDetails || {};
  return {
    applicant: data.applicantName,
    applicantAddress: formatAddress(d.applicantAddress) || "—",
    applicantPhone: applicantPhone || "—",
    owner: ownerName || "—",
    ownerAddress: ownerAddress || "—",
    ownerPhone: ownerPhone || "—",
    lga: d.council?.lga || "—",
    // What a CDC was decided under — the planning instrument, and the
    // part of the code where one is recorded. A CC job leaves this row
    // out: its authority is the development consent above it.
    epi: data.job.pathway === "CDC" ? [cd.relevantInstrument, cd.relevantPartOfCode].filter(Boolean).join(" - ") : "",
    devAddress: data.job.address || "—",
    lotDp: cd.lotSectionDp || "—",
    ocType: data.record.type === "whole" ? "Whole" : "Partial",
    description: data.record.description || data.job.description || "—",
    bcaClass: formatClassifications(d.proposal?.classifications) || "—",
    bcaVersion: formatBcaVersion(d.bcaVersion, d.bcaVolumes) || "—",
    attachments: "Schedule 1",
    exclusions: (data.record.exclusions || "").trim(),
    consentRelied: data.consentRef || "—",
    // Blank on a CDC job, which has no development consent behind it —
    // the rows that carry them are dropped rather than printed empty.
    daNumber: data.daNumber || "",
    daDate: data.daDate || "",
    issuedDate: data.issuedDate,
    certificateNumber: data.ref,
    certifierName: data.issuedBy?.name || "—",
    registrationBody: data.issuedBy?.registration_body || "—",
    registrationNo: data.issuedBy?.registration_no || "—",
  };
}
