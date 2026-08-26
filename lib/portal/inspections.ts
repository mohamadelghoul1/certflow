// Translating a CertFlow inspection into the NSW Planning Portal's exact
// vocabulary.
//
// The Portal's PCC service accepts only fixed lists of inspection types
// and results (docs/planning-portal/pcc-certifier-schemas.json, taken
// from the department's own API specification). CertFlow's inspection
// names are the certifier's working shorthand — "Slab Steel", "Frame" —
// so this file is the dictionary between the two. Anything without a
// match goes up as "Other Inspection" with the CertFlow title carried in
// the description, which the spec provides for exactly this case.

// The Portal's own values, verbatim from the specification. Not to be
// reworded — the service rejects anything off-list.
export const PORTAL_INSPECTION_TYPES = {
  afterExcavation: "After excavation (prior to placement of foot)",
  footings: "Foundation / footings (prior to pouring of concrete)",
  framework: "Framework (prior to fixing floor, wall and ceiling linings)",
  waterproofing: "Waterproofing of wet areas (prior to covering)",
  stormwater: "Stormwater drainage (prior to covering)",
  finalisation: "Finalisation of works (all works completed)",
  finalInspection: "Final inspection",
  other: "Other Inspection",
} as const;

export const PORTAL_RESULTS_BUILDING = {
  passed: "Building works are satisfactory",
  passed_subject_to: "Building has minor defects but is satisfactory",
  failed: "Building works are not satisfactory",
} as const;

// Subdivision certificates use a different wording of the same three
// answers; the Portal treats them as distinct values.
export const PORTAL_RESULTS_WORKS = {
  passed: "Works are satisfactory",
  passed_subject_to: "Work has minor defects but is satisfactory",
  failed: "Works are not satisfactory",
} as const;

// CertFlow's standard stages, mapped by what the inspection actually is
// rather than by exact spelling — matched loosely so "Piers & Footings",
// "piers and footings" and "Footings" all land on the same Portal value.
export function portalInspectionType(certflowTitle: string): string {
  const t = certflowTitle.toLowerCase();
  if (t.includes("excavation")) return PORTAL_INSPECTION_TYPES.afterExcavation;
  if (t.includes("footing") || t.includes("pier") || t.includes("slab")) return PORTAL_INSPECTION_TYPES.footings;
  if (t.includes("frame")) return PORTAL_INSPECTION_TYPES.framework;
  if (t.includes("waterproof") || t.includes("wet area")) return PORTAL_INSPECTION_TYPES.waterproofing;
  if (t.includes("stormwater") || t.includes("drainage")) return PORTAL_INSPECTION_TYPES.stormwater;
  if (t.includes("final")) return PORTAL_INSPECTION_TYPES.finalisation;
  return PORTAL_INSPECTION_TYPES.other;
}

export function portalInspectionResult(outcome: string, kind: "building" | "works" = "building"): string | null {
  const table = kind === "works" ? PORTAL_RESULTS_WORKS : PORTAL_RESULTS_BUILDING;
  return table[outcome as keyof typeof table] || null;
}

// A document as the Portal wants it: not the file itself but a link it
// downloads from. CertFlow's storage links are signed and short-lived,
// which suits this — the Portal fetches promptly, and the link then dies.
//
// Each call accepts only its own documentType, enforced by the live
// service though absent from the specification: recording the visit
// takes "Inspection images" (the photos), and the type for the close-out
// was learned the same way — from the service's own refusals.
export const PORTAL_DOC_TYPES = {
  photos: "Inspection images",
  report: "Inspection report",
} as const;

export type PortalDocument = {
  documentName: string;
  documentType: string;
  uploadedDateTime: string;
  documentURL: string;
};

export function portalDocument(fileName: string, signedUrl: string, documentType: string): PortalDocument {
  return {
    documentName: fileName,
    documentType,
    uploadedDateTime: new Date().toISOString(),
    documentURL: signedUrl,
  };
}

// The three calls that report one inspection, in the order the Portal's
// own workflow runs them: open an inspection case, record the visit,
// close it out. Each builder returns exactly the body the specification
// asks for — the tests hold them against the schema file.

export function initiateInspectionBody(input: { certflowTitle: string; scheduledDate?: string | null; registrationNumber: string; updatedByEmail?: string }) {
  const type = portalInspectionType(input.certflowTitle);
  return {
    ...(input.scheduledDate ? { dateOfInspection: input.scheduledDate } : {}),
    // The specification asks for this only on "Other Inspection"; the
    // live service demanded it on every type ("Description required"),
    // so it always carries the inspection's CertFlow name.
    description: input.certflowTitle,
    registrationNumber: input.registrationNumber,
    inspectionType: [type],
    ...(input.updatedByEmail ? { updatedByEmail: input.updatedByEmail } : {}),
  };
}

export function performInspectionBody(input: {
  childCaseID: string;
  certflowTitle: string;
  inspectionDate: string;
  outcome: string;
  inspectorName: string;
  comments?: string | null;
  documents: PortalDocument[];
  resultKind?: "building" | "works";
  updatedByEmail?: string;
}) {
  return {
    childCaseID: input.childCaseID,
    inspectionPerformedDate: input.inspectionDate,
    ...(input.comments ? { enterComments: input.comments } : {}),
    inspectionConductedBy: input.inspectorName,
    inspectionResult: portalInspectionResult(input.outcome, input.resultKind) || "",
    inspectionType: [portalInspectionType(input.certflowTitle)],
    documents: input.documents,
    ...(input.updatedByEmail ? { updatedByEmail: input.updatedByEmail } : {}),
  };
}

export function completeInspectionBody(input: {
  childCaseID: string;
  furtherInspectionRequired: boolean;
  declarations: string;
  inspectionResultDeclaration: string;
  documents: PortalDocument[];
  updatedByEmail?: string;
}) {
  return {
    childCaseID: input.childCaseID,
    issueInspectionResultSheet: true,
    isfurtherInspectionrequired: input.furtherInspectionRequired,
    declarations: input.declarations,
    inspectionResultDeclaration: input.inspectionResultDeclaration,
    documents: input.documents,
    ...(input.updatedByEmail ? { updatedByEmail: input.updatedByEmail } : {}),
  };
}
