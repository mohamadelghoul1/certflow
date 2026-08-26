// Working out what a certifier's spreadsheet columns actually mean.
//
// Every system exports different headings for the same thing — "Site
// Address", "Property Address", "Address of Development" — and asking
// someone to rename thirty columns to our spelling before they can move
// their jobs across is the sort of demand that stops a migration
// happening at all. So the headings are matched instead: normalised to
// bare letters, then compared against what each field is plausibly
// called, longest and most specific first.

export type JobField =
  | "reference"
  | "address"
  | "description"
  | "lotSectionDp"
  | "lga"
  | "applicantName"
  | "applicantAddress"
  | "applicantPhone"
  | "applicantEmail"
  | "ownerName"
  | "approvalType"
  | "approvalNumber"
  | "approvalDate"
  | "approvalIssuedBy"
  | "portalCase"
  | "projectNumber"
  | "classification"
  | "zoning"
  // Exports commonly split what CertFlow keeps together, so the parts
  // are recognised in their own right and joined back up on the way in.
  | "lot"
  | "plan"
  | "applicantStreetNumber"
  | "applicantStreet"
  | "applicantSuburb"
  | "applicantState"
  | "applicantPostcode"
  | "estimatedCost"
  | "certifierName"
  | "principalContractor";

// Order matters: the first field whose name matches a heading claims it,
// so the more specific names are listed before the ones that would also
// match them. "Applicant address" must be tried before "address".
const NAMES: { field: JobField; label: string; names: string[] }[] = [
  { field: "applicantAddress", label: "Applicant address", names: ["applicantaddress", "applicantpostaladdress", "clientaddress", "ownerapplicantaddress"] },
  { field: "applicantName", label: "Applicant", names: ["applicant", "applicantname", "applicantcompany", "client", "clientname", "customer", "customername", "contactname"] },
  { field: "applicantPhone", label: "Applicant phone", names: ["applicantphone", "clientphone", "phone", "mobile", "contactnumber", "contactphone", "telephone"] },
  { field: "applicantEmail", label: "Applicant email", names: ["applicantemail", "clientemail", "email", "emailaddress", "contactemail"] },
  { field: "ownerName", label: "Owner", names: ["owner", "ownername", "propertyowner", "landowner", "registeredowner"] },
  // No bare "site" here: it appears inside "depoSITEd plan number", and
  // a heading matched by accident is worse than one left unmatched.
  { field: "address", label: "Property address", names: ["address", "siteaddress", "propertyaddress", "developmentaddress", "addressofdevelopment", "jobaddress", "projectaddress"] },
  { field: "description", label: "Scope of works", names: ["description", "scope", "scopeofworks", "scopeofwork", "works", "projectdescription", "developmentdescription", "proposal", "descriptionofworks"] },
  { field: "lotSectionDp", label: "Lot / Section / Plan", names: ["lotsectiondp", "lotdp", "lotsectionplan", "lot", "legaldescription", "lotanddp", "propertydescription"] },
  { field: "lga", label: "Council", names: ["lga", "council", "localgovernmentarea", "consentauthority", "councilname"] },
  { field: "approvalType", label: "Approval type", names: ["approvaltype", "certificatetype", "consenttype", "type", "pathway"] },
  { field: "approvalNumber", label: "CDC / CC number", names: ["cdcnumber", "ccnumber", "cdccc", "certificatenumber", "approvalnumber", "consentnumber", "cdc", "cc", "certificateno", "determinationnumber"] },
  { field: "approvalDate", label: "Approval date", names: ["approvaldate", "determinationdate", "dateissued", "issuedate", "certificatedate", "datedetermined", "dateofdetermination"] },
  { field: "approvalIssuedBy", label: "Approval issued by", names: ["issuedby", "approvalissuedby", "certifier", "certifyingauthority", "issuingauthority", "previouscertifier"] },
  { field: "portalCase", label: "Portal case", names: ["portalcase", "planningportalref", "portalref", "portalreference", "caseid", "casenumber", "cftnumber", "cft", "pca", "pcanumber", "eplanningref"] },
  { field: "projectNumber", label: "Project number", names: ["projectnumber", "jobnumber", "jobno", "projectno", "reference", "referencenumber", "ourref", "fileno", "filenumber"] },
  { field: "classification", label: "BCA classification", names: ["classification", "bcaclass", "bcaclassification", "buildingclass", "class", "nccclass"] },
  { field: "zoning", label: "Zoning", names: ["zoning", "zone", "landusezone", "landzoning", "landuse"] },
  { field: "lot", label: "Lot", names: ["lotnumber", "lotno"] },
  { field: "plan", label: "Plan", names: ["plan", "dp", "dpnumber", "planno", "depositedplan", "depositedplannumber", "strataplan"] },
  { field: "applicantStreetNumber", label: "Applicant street number", names: ["streetnumber", "streetno", "housenumber", "unitnumber"] },
  { field: "applicantStreet", label: "Applicant street", names: ["street", "streetname", "roadname"] },
  { field: "applicantSuburb", label: "Applicant suburb", names: ["suburb", "town", "locality", "city"] },
  { field: "applicantState", label: "Applicant state", names: ["state", "stateterritory"] },
  { field: "applicantPostcode", label: "Applicant postcode", names: ["postcode", "postalcode", "zip"] },
  { field: "estimatedCost", label: "Estimated cost", names: ["estimatedcost", "cost", "costofworks", "value", "constructionvalue", "estimatedvalue", "contractvalue"] },
  { field: "certifierName", label: "Certifier", names: ["assignedcertifier", "certifiername", "nominatedcertifier", "principalcertifier"] },
  { field: "principalContractor", label: "Principal contractor", names: ["principalcontractor", "principalcontractorname", "builder", "buildername", "contractor", "contractorname"] },
  { field: "reference", label: "Reference", names: ["ref", "casereference", "applicationnumber", "applicationno"] },
];

export const FIELD_LABELS: Record<JobField, string> = NAMES.reduce(
  (all, { field, label }) => ({ ...all, [field]: label }),
  {} as Record<JobField, string>
);

export function normaliseHeading(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Which column holds which field. A heading matches when its bare
// letters equal one of the field's names, or contain one — so "Site
// Address (full)" still lands on the address. A field already claimed
// does not take a second column, and a column already claimed is not
// offered to a later field.
export function matchColumns(headers: string[]): Partial<Record<JobField, number>> {
  const normalised = headers.map(normaliseHeading);
  const found: Partial<Record<JobField, number>> = {};
  const taken = new Set<number>();

  const claim = (field: JobField, index: number) => {
    if (found[field] !== undefined || taken.has(index)) return;
    found[field] = index;
    taken.add(index);
  };

  // Exact matches first, across every field, so a column named plainly
  // is never stolen by another field's loose match.
  for (const { field, names } of NAMES) {
    const exact = normalised.findIndex((heading, i) => !taken.has(i) && names.includes(heading));
    if (exact >= 0) claim(field, exact);
  }
  for (const { field, names } of NAMES) {
    if (found[field] !== undefined) continue;
    const loose = normalised.findIndex((heading, i) => !taken.has(i) && heading.length > 2 && names.some((name) => heading.includes(name)));
    if (loose >= 0) claim(field, loose);
  }

  return found;
}
