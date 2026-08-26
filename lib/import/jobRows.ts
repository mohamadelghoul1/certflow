import { splitAddress } from "@/lib/import/address";
import { matchColumns, FIELD_LABELS, type JobField } from "@/lib/import/jobColumns";
import { inferColumns } from "@/lib/import/inferColumns";
import type { ParsedPaste } from "@/lib/import/parseTable";
import type { JobDetails } from "@/types/db";
import { normalizePortalRef } from "@/lib/business";

// Turning a row of someone else's spreadsheet into a CertFlow project.
//
// These are jobs already under construction elsewhere: the certificate
// was issued by whoever held the appointment before, and what is wanted
// here is the inspections and the occupation certificate. That is
// exactly a PC/OC job, so that is what every imported row becomes — the
// previously issued approval recorded against it rather than invented.
//
// Nothing is rejected for being incomplete. A migration that refuses
// three hundred jobs over a missing postcode does not happen; the gaps
// are reported per row instead, and the fields that matter are checked
// again at the moment the occupation certificate is issued.

export type ImportedJob = {
  rowNumber: number;
  address: string;
  description: string;
  details: JobDetails;
  // What is missing or was guessed at, in the certifier's words.
  warnings: string[];
};

export type ImportPreview = {
  matched: Partial<Record<JobField, number>>;
  unmatchedHeadings: string[];
  jobs: ImportedJob[];
  // True when the paste carried no heading row and the columns were read
  // from the values instead — worth saying, because it is a reading the
  // certifier should check rather than assume.
  inferred: boolean;
  headers: string[] | null;
};

// A row is a heading row when enough of it matches names CertFlow knows.
// Two is deliberately low: a spreadsheet with only "Address" and "Scope"
// as recognisable headings is still a heading row.
export function looksLikeHeadings(row: string[]): boolean {
  return Object.keys(matchColumns(row)).length >= 2;
}

function classificationsFrom(text: string): string[] {
  // "1a", "Class 1a", "1a, 10a" and "Class 1a & 10b" all mean the same
  // list of classes.
  return (text.match(/\b(\d{1,2}[a-z]?)\b/gi) || []).map((code) => code.toLowerCase());
}

function approvalTypeFrom(text: string, approvalNumber: string): "CDC" | "CC" {
  const haystack = `${text} ${approvalNumber}`.toLowerCase();
  if (/\bcc\b|construction/.test(haystack) && !/\bcdc\b|complying/.test(haystack)) return "CC";
  return "CDC";
}

export function buildPreview(paste: ParsedPaste, certifierNames: string[] = []): ImportPreview {
  const inferred = paste.headers === null;
  const matched = inferred ? inferColumns(paste.rows, certifierNames) : matchColumns(paste.headers!);
  const claimed = new Set(Object.values(matched));
  const unmatchedHeadings = (paste.headers || []).filter((heading, i) => heading.trim() !== "" && !claimed.has(i));

  const jobs = paste.rows.map((row, index) => {
    const cell = (field: JobField): string => {
      const at = matched[field];
      return at === undefined ? "" : (row[at] || "").trim();
    };

    const warnings: string[] = [];
    const need = (value: string, field: JobField) => {
      if (!value) warnings.push(`No ${FIELD_LABELS[field].toLowerCase()}`);
      return value;
    };

    const address = need(cell("address"), "address");
    const description = cell("description") || "Building works";
    if (!cell("description")) warnings.push("No scope of works — set to “Building works”");

    // An export either keeps the applicant's address as one line or
    // splits it into its parts. Both arrive here; the split parts win,
    // because they need no interpreting.
    const applicantLine = cell("applicantAddress");
    const fromLine = splitAddress(applicantLine);
    const applicant = {
      streetNumber: cell("applicantStreetNumber") || fromLine.streetNumber,
      street: cell("applicantStreet") || fromLine.street,
      suburb: cell("applicantSuburb") || fromLine.suburb,
      state: cell("applicantState") || fromLine.state,
      postcode: cell("applicantPostcode") || fromLine.postcode,
    };
    if (applicantLine && !fromLine.suburb && !cell("applicantSuburb")) warnings.push("Applicant address could not be split — check it on the job");

    // Lot and plan are often separate columns; the certificate prints
    // them as one line.
    const lotAndPlan = [cell("lot"), cell("plan")].filter(Boolean).join(" / ");

    const approvalNumber = need(cell("approvalNumber"), "approvalNumber");
    const approvalType = approvalTypeFrom(cell("approvalType"), approvalNumber);
    const classifications = classificationsFrom(cell("classification"));
    if (classifications.length === 0) warnings.push("No BCA classification");
    const lotSectionDp = cell("lotSectionDp") || lotAndPlan;
    if (!lotSectionDp) warnings.push(`No ${FIELD_LABELS.lotSectionDp.toLowerCase()}`);
    need(cell("lga"), "lga");

    const details: JobDetails = {
      projectNumber: cell("projectNumber") || cell("reference"),
      zoning: cell("zoning"),
      bcaVersion: "",
      bcaVolumes: [],
      contact: {
        nameOrCompany: cell("applicantName"),
        title: "",
        givenNames: "",
        surname: "",
        phone: cell("applicantPhone"),
        mobile: "",
        email: cell("applicantEmail"),
      },
      applicantAddress: {
        streetNumber: applicant.streetNumber,
        street: applicant.street,
        suburb: applicant.suburb,
        state: applicant.state,
        postcode: applicant.postcode,
      },
      // Only set to false when an owner is actually named, so a job with
      // no owner column does not demand owner details it never had.
      ownerSameAsApplicant: !cell("ownerName"),
      owner: {
        name: cell("ownerName"),
        phone: "",
        address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" },
      },
      council: {
        lga: cell("lga"),
        address: { streetNumber: "", street: "", suburb: "", state: "NSW", postcode: "" },
        contact: { phone: "", email: "" },
      },
      proposal: {
        classifications,
        constructionType: "N/A",
        dwellingsExisting: "",
        dwellingsDemolished: "",
        dwellingsNew: "",
        estimatedCost: cell("estimatedCost").replace(/[$,]/g, "").replace(/\.00$/, ""),
        storeysAbove: "",
        storeysBelow: "",
        storeysTotal: "",
        effectiveHeight: "",
        floorAreaExisting: "",
        floorAreaNew: "",
      },
      siteArea: "",
      // The case inspections are reported against, so the Portal panel
      // fills itself in on an imported job the same as on a new one.
      inspectionPortalCase: cell("portalCase") || cell("reference"),
      certificateDetails: {
        lotSectionDp,
        planningPortalRef: "",
        relevantInstrument: "",
        relevantPartOfCode: "",
        codeParts: [],
        determinationDate: "",
        developmentConsentNumber: "",
        developmentConsentDate: "",
        consentReferences: "",
      },
      priorApproval: {
        type: approvalType,
        number: approvalNumber,
        date: cell("approvalDate"),
        issuedBy: cell("approvalIssuedBy"),
        portalRef: normalizePortalRef(cell("portalCase") || cell("reference"), approvalType),
      },
    };

    return { rowNumber: index + 2, address, description, details, warnings };
  });

  return { matched, unmatchedHeadings, jobs, inferred, headers: paste.headers };
}
