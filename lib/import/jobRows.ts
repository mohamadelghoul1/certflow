import { splitAddress } from "@/lib/address";
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
  // The certifier this job is named against in the export, so a firm
  // with several does not have every imported job land on one of them.
  certifierName: string;
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

    // An export that carries no property address column carries the site
    // in its street/suburb columns instead — which is the shape of BCS's
    // own export. Composed rather than left blank, because a job with no
    // address cannot be imported at all, and flagged because whether
    // those columns hold the site or the applicant's postal address is
    // the certifier's to confirm, not mine to assume.
    const composedAddress = [[cell("applicantStreetNumber"), cell("applicantStreet")].filter(Boolean).join(" "), cell("applicantSuburb")]
      .filter(Boolean)
      .join(", ");
    const address = cell("address") || composedAddress;
    if (!address) warnings.push(`No ${FIELD_LABELS.address.toLowerCase()}`);
    else if (!cell("address")) warnings.push("Address built from the street and suburb columns — check it is the site, not the applicant's postal address");
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

    // Where the export gives no applicant address of its own — or gives
    // the very columns the site address was just built from — the two
    // are the same address, so the job is marked as such rather than
    // arriving short of the fields an occupation certificate needs.
    const applicantSameAsSite = !!address && (!cell("address") || !(applicant.street || applicant.suburb));
    const applicantAddress = applicantSameAsSite ? splitAddress(address) : applicant;

    // Lot and plan are often separate columns; the certificate prints
    // them as one line.
    const lotAndPlan = [cell("lot"), cell("plan")].filter(Boolean).join(" / ");

    const approvalNumber = need(cell("approvalNumber"), "approvalNumber");
    const approvalType = approvalTypeFrom(cell("approvalType"), approvalNumber);

    // Which case inspections are filed against. A CFT or PCA number is a
    // case the Portal keeps open through construction, so it serves; a
    // CDC number is the application case, which closes on determination
    // and then refuses inspections outright. Where an export gives only
    // the latter, the gap is named rather than filled with a number
    // certain to be rejected.
    const openCase = (value: string) => /^(CFT|PCA)\b/i.test(value.trim());
    const reportingCase = cell("portalCase") || [approvalNumber, cell("reference")].find(openCase) || "";
    if (!reportingCase) {
      warnings.push("No Portal case for reporting inspections — add it on the project before reporting one");
    }
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
      applicantSameAsSite,
      applicantAddress,
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
      // The case inspections are reported against — and only ever from a
      // column that genuinely holds one. The reference an export files a
      // job under is the CDC's own application case, which the Portal
      // closes the moment the certificate is determined and then refuses
      // to accept inspections against ("Cannot perform this action for
      // closed cases"). Filling this from that reference would give every
      // imported job a case number certain to be rejected, discovered one
      // by one at the moment each inspection was reported.
      inspectionPortalCase: reportingCase,
      principalContractor: cell("principalContractor"),
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
        // The original certificate's own Portal case, which is exactly
        // what that reference is.
        portalRef: normalizePortalRef(cell("reference") || cell("portalCase"), approvalType),
      },
    };

    return { rowNumber: index + 2, address, description, details, certifierName: cell("certifierName"), warnings };
  });

  return { matched, unmatchedHeadings, jobs, inferred, headers: paste.headers };
}
