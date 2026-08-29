import { FIELD_KEYS, isRequired, type CertificatePathway, type FieldKey, type FieldValues } from "@/lib/certificates/templateFields";

// The shape of a certificate: sections, and the rows under them.
//
// The default below is the certificate Certlyn has always printed,
// written out as data instead of as code. A firm that has never touched
// it gets exactly that. A firm that wants their own starts from a copy of
// it and edits from there, so "their own template" is never a blank page.

export type TemplateRow = {
  // Which value fills the row, or "fixed" for wording of the firm's own.
  source: FieldKey | "fixed";
  // What the row is called on the certificate. The firm's to change.
  label: string;
  // For a fixed row: what it says.
  fixedValue?: string;
  // Left off the certificate entirely when it has no value, rather than
  // printing a label with nothing beside it. A CDC job has no
  // development consent behind it, and an empty "Development Consent
  // (DA) No.:" reads as a certificate missing something.
  hideWhenEmpty?: boolean;
};

// A section with no heading prints its rows and nothing else — an
// Occupation Certificate opens with a block of details under the title
// rather than under a heading of its own.
export type TemplateSection = { heading: string; rows: TemplateRow[] };
export type CertificateTemplate = { pathway: CertificatePathway; sections: TemplateSection[] };

const f = (source: FieldKey, label: string): TemplateRow => ({ source, label });

// Transcribed row for row from what the certificate printed before it was
// a template, down to the labels that differ between the two pathways
// (a CDC says "Lot/Section/DP:", a CC says "Lot/ DP:") — because a
// certificate that changed the day it became configurable would be a
// different document with no one having asked for one.
export const DEFAULT_TEMPLATES: Record<CertificatePathway, CertificateTemplate> = {
  CDC: {
    pathway: "CDC",
    sections: [
      { heading: "APPLICANT DETAILS", rows: [f("applicant", "Applicant:"), f("applicantAddress", "Address:"), f("applicantPhone", "Phone:")] },
      { heading: "OWNER DETAILS", rows: [f("owner", "Owner"), f("ownerAddress", "Address:"), f("ownerPhone", "Phone:")] },
      {
        // The heading carries the pathway's full name, filled in by the
        // renderer, so a firm that renames it keeps their own wording.
        heading: "{PATHWAY} DETAILS",
        rows: [
          f("planningPortalRef", "NSW Planning Portal Ref Number:"),
          f("lga", "Local Government Area:"),
          f("epi", "Relevant Environmental Planning Instrument"),
          f("partOfCode", "Relevant Part of Code"),
          f("determinationDate", "Date of Determination:"),
          f("lapseDate", "Date of Lapse:"),
        ],
      },
      {
        heading: "PROPOSAL",
        rows: [
          f("devAddress", "Address of Development:"),
          f("lotDp", "Lot/Section/DP:"),
          f("zone", "Land Use Zone:"),
          f("bcaClass", "BCA Classification/s:"),
          f("bcaVersion", "BCA/NCC Version:"),
          f("description", "Description of Building Works:"),
          f("value", "Value of Construction (incl. GST):"),
          f("attachments", "Attachments"),
          f("conditions", "Conditions:"),
          f("inspections", "Critical stage inspections:"),
        ],
      },
      {
        heading: "REGISTERED CERTIFIER",
        rows: [f("certifierName", "Registered Certifier:"), f("registrationBody", "Registration Body:"), f("registrationNo", "Registration No:")],
      },
    ],
  },
  CC: {
    pathway: "CC",
    sections: [
      { heading: "APPLICANT DETAILS", rows: [f("applicant", "Applicant:"), f("applicantAddress", "Address:"), f("applicantPhone", "Phone:")] },
      { heading: "OWNER DETAILS", rows: [f("owner", "Owner:"), f("ownerAddress", "Address:"), f("ownerPhone", "Phone:")] },
      {
        heading: "RELEVANT DEVELOPMENT CONSENTS",
        rows: [
          f("lga", "Consent Authority / Local Government Area:"),
          f("developmentConsentNumber", "Development Consent Number:"),
          f("developmentConsentDate", "Development Consent Date:"),
          f("planningPortalRef", "NSW Planning Portal Ref Number:"),
          f("certificateNumber", "Construction Certificate Number:"),
          f("issuedDate", "Date of Issue of Construction Certificate:"),
        ],
      },
      {
        heading: "PROPOSAL",
        rows: [
          f("devAddress", "Address of Development:"),
          f("lotDp", "Lot/ DP:"),
          f("bcaClass", "BCA Classification:"),
          f("bcaVersion", "BCA/NCC Version:"),
          f("description", "Description of Building Works:"),
          f("value", "Value of Construction Certificate (incl. GST)"),
          f("attachments", "Attachments:"),
          f("inspections", "Critical Stage Inspections:"),
        ],
      },
      {
        heading: "REGISTERED CERTIFIER",
        rows: [f("certifierName", "Registered Certifier:"), f("registrationBody", "Registration Body:"), f("registrationNo", "Registration No:")],
      },
    ],
  },
  OC: {
    pathway: "OC",
    sections: [
      {
        // No heading: these rows sit straight under the certificate's
        // own title, as they always have.
        heading: "",
        rows: [
          f("devAddress", "Property address:"),
          f("lotDp", "Lot/Section/DP:"),
          f("description", "Development description:"),
          f("bcaClass", "Building classification(s):"),
          // {CONSENT} is filled in with what the job was approved under
          // — a complying development certificate or a construction
          // certificate — so one row covers both without a firm that
          // renames it losing that.
          f("consentRelied", "{CONSENT} relied upon:"),
          { source: "daNumber", label: "Development Consent (DA) No.:", hideWhenEmpty: true },
          { source: "daDate", label: "Development Consent (DA) date:", hideWhenEmpty: true },
          f("issuedDate", "Date of issue:"),
        ],
      },
    ],
  },
};

// A row ready to be drawn: what it is called and what it says. "conditions"
// keeps its own kind because it prints as paragraphs under the label
// rather than as a single value beside it.
export type ResolvedRow = { key: string; label: string; value: string; kind: "field" | "conditions" };
export type ResolvedSection = { heading: string; rows: ResolvedRow[] };

export function resolveTemplate(template: CertificateTemplate, values: FieldValues, pathwayFull: string, consentLabel = ""): ResolvedSection[] {
  const fill = (text: string) => text.replace("{PATHWAY}", pathwayFull.toUpperCase()).replace("{CONSENT}", consentLabel);

  return template.sections.map((section) => ({
    heading: fill(section.heading),
    rows: section.rows
      .map((row) => ({
        key: row.source,
        label: fill(row.label),
        value: row.source === "fixed" ? row.fixedValue || "" : values[row.source] || "",
        kind: row.source === "conditions" ? ("conditions" as const) : ("field" as const),
        hideWhenEmpty: row.hideWhenEmpty === true,
      }))
      .filter((row) => !(row.hideWhenEmpty && !row.value.trim()))
      .map(({ hideWhenEmpty: _hide, ...row }) => row),
  }));
}

// What a firm's stored template is checked against before it is used.
//
// A template is edited by people and stored as JSON, so it can arrive
// malformed — an unknown source after a rename, a required row someone
// deleted straight in the database. Rather than print a broken
// certificate, an unusable template is rejected and the default is used.
export function templateProblems(template: CertificateTemplate): string[] {
  const problems: string[] = [];
  const keys = new Set<string>(FIELD_KEYS);
  const present = new Set<string>();

  if (template.sections.length === 0) problems.push("A certificate needs at least one section.");

  for (const section of template.sections) {
    for (const row of section.rows) {
      if (!row.label.trim()) problems.push(`A row under “${section.heading}” has no label.`);
      if (row.source !== "fixed" && !keys.has(row.source)) problems.push(`“${row.label}” is filled by something this certificate does not have (${row.source}).`);
      present.add(row.source);
    }
  }

  for (const key of FIELD_KEYS) {
    if (isRequired(template.pathway, key) && !present.has(key)) {
      problems.push(`A ${template.pathway} must carry ${key}, and this template does not.`);
    }
  }

  return problems;
}
