// What a certificate can put on the page, and what fills it.
//
// The certificate used to be a script: a list of l.fieldRow calls written
// into the renderer, the same for every firm. That is fine for one firm
// and wrong for two — another practice wants a row we do not print, or
// does not want one we do.
//
// So the certificate is described rather than scripted. A template is a
// list of sections, each a list of rows; a row names a value from the
// catalogue below, or carries wording of its own. The renderer walks the
// template instead of a fixed script, and the default template reproduces
// exactly what has always been printed.

export type CertificatePathway = "CDC" | "CC";

// Every value a row can show. The renderer works these out once from the
// job and hands them over as a plain record, so the catalogue names
// values rather than reaching into the data itself — one place to look
// when asking "where does this row come from".
export const FIELD_KEYS = [
  "applicant",
  "applicantAddress",
  "applicantPhone",
  "owner",
  "ownerAddress",
  "ownerPhone",
  "planningPortalRef",
  "lga",
  "epi",
  "partOfCode",
  "determinationDate",
  "lapseDate",
  "developmentConsentNumber",
  "developmentConsentDate",
  "certificateNumber",
  "issuedDate",
  "devAddress",
  "lotDp",
  "zone",
  "bcaClass",
  "bcaVersion",
  "description",
  "value",
  "attachments",
  "conditions",
  "inspections",
  "certifierName",
  "registrationBody",
  "registrationNo",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export type FieldValues = Partial<Record<FieldKey, string>>;

// What each value is called when a certifier is choosing rows to add.
// Not the printed label — that is the template's, and can be renamed.
export const FIELD_NAMES: Record<FieldKey, string> = {
  applicant: "Applicant name",
  applicantAddress: "Applicant address",
  applicantPhone: "Applicant phone",
  owner: "Owner name",
  ownerAddress: "Owner address",
  ownerPhone: "Owner phone",
  planningPortalRef: "NSW Planning Portal reference",
  lga: "Local government area",
  epi: "Relevant environmental planning instrument",
  partOfCode: "Relevant part of the code",
  determinationDate: "Date of determination",
  lapseDate: "Date of lapse",
  developmentConsentNumber: "Development consent number",
  developmentConsentDate: "Development consent date",
  certificateNumber: "Certificate number",
  issuedDate: "Date of issue",
  devAddress: "Address of development",
  lotDp: "Lot / Section / DP",
  zone: "Land use zone",
  bcaClass: "BCA classification",
  bcaVersion: "BCA / NCC version",
  description: "Description of building works",
  value: "Value of construction",
  attachments: "Attachments",
  conditions: "Conditions",
  inspections: "Critical stage inspections",
  certifierName: "Registered certifier",
  registrationBody: "Registration body",
  registrationNo: "Registration number",
};

// Rows a certificate must carry, whatever a firm prefers.
//
// A CDC and a CC have content the EP&A Regulation requires, and a
// template that could drop it would let a firm issue a certificate that
// is not one. These stay in the list and cannot be removed — a firm can
// still rename the label, because what it is called is theirs and what
// it says is not.
//
// Worth confirming against the current Regulation before relying on it:
// this is the list the certificates have always printed, not advice.
export const REQUIRED_FIELDS: Record<CertificatePathway, FieldKey[]> = {
  CDC: ["applicant", "owner", "devAddress", "lotDp", "description", "determinationDate", "certifierName", "registrationNo"],
  CC: ["applicant", "owner", "devAddress", "lotDp", "description", "developmentConsentNumber", "certifierName", "registrationNo"],
};

export function isRequired(pathway: CertificatePathway, key: string): boolean {
  return REQUIRED_FIELDS[pathway].includes(key as FieldKey);
}
