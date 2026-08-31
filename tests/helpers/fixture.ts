import type { PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { preInspectionRows, type PreInspectionData } from "@/lib/certificates/preInspectionData";
import { epiForCodeParts } from "@/lib/constants";
import type { NeighbourLetterData } from "@/lib/certificates/neighbourLetterData";
import type { InspectionReportData } from "@/lib/certificates/inspectionReportData";
import type { OcCertificateData } from "@/lib/certificates/ocData";
import type { Firm, Certifier } from "@/types/db";
import { DEFAULT_TEMPLATES } from "@/lib/certificates/certificateTemplate";

// One job, complete enough to generate every document from. Overrides let
// a test vary only what it cares about.
export function certificateFixture(overrides: Record<string, unknown> = {}): PathwayCertificateData {
  const codeParts = ["Schedule One Complying Development Secondary Dwelling"];
  return {
    job: {
      id: "job-1",
      address: "21 Coquet Way Green Valley",
      pathway: "CDC",
      description: "Construction of a detached secondary dwelling",
      details: {},
      pathway_signed_at: null,
      pathway_version: 1,
    },
    firm: {
      name: "Quality Private Certifiers Pty Ltd",
      abn: "41 630 945 416",
      office_address: "Suite 2/F1 101 Rookwood Road, Yagoona NSW 2199",
      postal_address: "PO BOX 195, Blaxcell NSW 2142",
      phone: "0404 940 898",
      email: "info@example.com",
      website: "www.example.com",
    },
    issuedBy: { name: "Mohamad El Ghoul", registration_no: "BDC2961", registration_body: "Building Commission NSW", signature_url: null },
    conditions: [],
    allItems: [
      { id: "1", title: "CDC Application Form", status: "approved", document_date: "2026-08-01", prepared_by: "Owner", drawing_number: "F-01", revision: "A" },
      // No date recorded — this is the row that used to read "Not yet scheduled".
      { id: "2", title: "Site Plan", status: "approved", document_date: null, prepared_by: "Studio North", drawing_number: null, revision: null },
    ],
    selectedInspections: [
      { id: "1", stage: "After excavation for and prior to placement of any footings", inspector: "Registered Certifier & Structural Engineer", enabled: true },
    ],
    activeVersionId: "v1",
    signatureUrl: null,
    uploadedApprovalUrl: null,
    logoUrl: null,
    lapseDate: "2031-08-24",
    ref: "CDC-26001/01",
    projRef: "CDC-26001",
    isCdc: true,
    pathwayFull: "Complying Development Certificate",
    // As getPathwayCertificateData resolves them for an ordinary first
    // issue. Ahead of the spread so a modification test can override.
    isModification: false,
    modificationReason: null,
    modificationLabel: null,
    letterCertLabel: "Complying Development Certificate No.:",
    d: {
      council: { lga: "Liverpool City Council", address: { streetNumber: "50", street: "Scott Street", suburb: "Liverpool", state: "NSW", postcode: "2170" } },
      applicantAddress: { streetNumber: "21", street: "Coquet Way", suburb: "Green Valley", state: "NSW", postcode: "2168" },
      contact: { nameOrCompany: "Mr Mark Zukerberg", phone: "0404040404", email: "applicant@example.com" },
      zoning: "R2",
      bcaVersion: "NCC 2022 Amendment 2",
      bcaVolumes: ["Volume Two"],
      proposal: { classifications: ["Class 1a — Single dwelling", "Class 10a — Non-habitable (garage, shed, carport)"], valueOfWorks: "155000" },
    },
    cd: {
      relevantInstrument: epiForCodeParts(codeParts),
      relevantPartOfCode: codeParts.join(", "),
      planningPortalRef: "CDC-261111",
      determinationDate: "2026-08-24",
      lotSectionDp: "339//DP815298",
    },
    issuedDate: "24 Aug 2026",
    applicantName: "Mr Mark Zukerberg",
    applicantPhone: "0404040404",
    ownerName: "Mr Mark Zukerberg",
    ownerAddress: "21 Coquet Way, Green Valley NSW 2168",
    ownerPhone: "0404040404",
    councilBody: ["Quality Private Certifiers Pty Ltd has issued a Complying Development Certificate under Part 4 of the Act for the above premises."],
    applicantBody: ["Quality Private Certifiers Pty Ltd has issued a Complying Development Certificate under Part 4 of the Act for the above premises."],
    requiredDocsList: ["Receipt of the Council Contribution Fee.", "Receipt of the Council Bond."],
    // The Section 58 paragraph, as getPathwayCertificateData resolves
    // it. Present because this fixture is cast: a field missing here is
    // not a type error, it is a crash in whatever reads it.
    inspectionsNotice: [
      "I, Mohamad El Ghoul of Quality Private Certifiers Pty Ltd, located at Yagoona NSW 2199, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.",
    ],
    // The layout the certificate is drawn from. A fixture without one
    // would test a certificate no firm can ever be issued.
    template: DEFAULT_TEMPLATES.CDC,
    templateProblems: [],
    ...overrides,
  } as unknown as PathwayCertificateData;
}

const preInspectionFirm = { name: "Quality Private Certifiers Pty Ltd", abn: "41 630 945 416", postal_address: "PO BOX 195", office_address: "Yagoona NSW 2199", phone: "0404 940 898", email: "info@example.com", website: "www.example.com" } as unknown as Firm;

// The same job as certificateFixture's, filled in the way the firm's own
// s139 and s16 reports are.
export function preInspectionFixture(isCdc: boolean): PreInspectionData {
  const ref = isCdc ? "CDC-26053/01" : "CC-25477/01";
  const regulationTitle = isCdc ? "139 EP and A Regulation 2021" : "S16 EP&A (Development Certification and Fire Safety) Regulation 2021";
  return {
    job: {} as never,
    firm: preInspectionFirm,
    inspector: null,
    logoUrl: null,
    signatureUrl: null,
    isCdc,
    regulationTitle,
    title: `INSPECTION REPORT – ${ref} – 1. ${regulationTitle}`,
    ref,
    projRef: isCdc ? "CDC-26053" : "CC-25477",
    address: "48 Alice Street, Rooty Hill NSW 2766",
    applicantName: "MD Shahidul Karim",
    applicantAddress: "48 Alice Street, Rooty Hill NSW 2766",
    applicantPhone: "0433650299",
    lga: "Blacktown City Council",
    developmentConsentNumber: isCdc ? "" : "DA-25-01431",
    certificateLabel: isCdc ? "CDC Number" : "Construction Certificate Number",
    applicationDate: "09 Dec 2025",
    inspectionDate: "20 Jan 2026",
    lotSectionDp: "9 / DP253031",
    zoning: "R2",
    scopeOfWorks: "Alterations and additions to a dwelling",
    inspectorName: "Mohamad El Ghoul",
    registrationNo: "BDC2961",
    rows: preInspectionRows(isCdc),
  };
}

const neighbourFirm = { name: "Quality Private Certifiers Pty Ltd", abn: "41 630 945 416", postal_address: "PO BOX 195", office_address: "Yagoona NSW 2199", phone: "02 8772 4022", email: "info@example.com", website: "www.example.com" } as unknown as Firm;
const neighbourCertifier = { name: "Mohamad El Ghoul", registration_no: "BDC2961" } as unknown as Certifier;

// The neighbour notification for one job, varying only the planning
// instrument the letter has to cite.
export function neighbourLetterFixture(relevantInstrument: string, relevantPartOfCode: string): NeighbourLetterData {
  return {
    firm: neighbourFirm,
    certifier: neighbourCertifier,
    jobAddress: "16 Wilkins Street, Yagoona",
    description: "Demolition of existing dwelling and construction of a two storey dwelling",
    applicantName: "Anh Cao",
    applicantPhone: "0400000000",
    applicantEmail: "applicant@example.com",
    applicantAddress: "16 Wilkins Street, Yagoona",
    relevantInstrument,
    relevantPartOfCode,
    projRef: "CDC-26001",
    issuedDate: "13 Jan 2026",
  };
}

// One inspection, complete enough to generate its report from. Overrides
// let a test vary only what it cares about — an outcome, a missing date.
export function inspectionReportFixture(overrides: Record<string, unknown> = {}): InspectionReportData {
  return {
    job: { address: "21 Coquet Way, Green Valley", description: "Construction of a detached secondary dwelling", pathway: "CDC" },
    firm: neighbourFirm,
    inspection: {
      id: "i1",
      title: "Slab Steel",
      date: "2026-08-20",
      outcome: "passed_subject_to",
      inspector_certifier_id: "c1",
      report_signed_at: "2026-08-25T00:00:00Z",
      report_intro_override: null,
      report_notes: null,
      defects: [
        { id: "d1", text: "Provide certification for the slab reinforcement from the structural engineer.", resolved: false },
        { id: "d2", text: "Termite barrier installation certificate required prior to the frame inspection.", resolved: true },
      ],
      inspection_photos: [],
    },
    inspector: { name: "Mohamad El Ghoul", registration_no: "BDC2961" },
    signatureUrl: null,
    logoUrl: null,
    photoUrls: [],
    d: { council: { lga: "Liverpool City Council" }, certificateDetails: { lotSectionDp: "9 / DP253031" }, zoning: "R2", contact: { phone: "0400000000", email: "applicant@example.com" } },
    applicantName: "Anh Cao",
    certRef: "CDC-26001/01",
    certNumbers: "CDC-26001/01",
    certTypeLabel: "Complying Development Certificate",
    consentRefLines: [],
    introText: "We have attended the above property and completed an inspection.",
    notes: "",
    ...overrides,
  } as unknown as InspectionReportData;
}

// One issued Occupation Certificate, complete enough to generate its
// package from. Overrides let a test vary only what it cares about — a
// partial OC, a job with a development consent behind it.
export function ocCertificateFixture(overrides: Record<string, unknown> = {}): OcCertificateData {
  // A partial OC's letter says which part it covers, exactly as
  // getOcCertificateData works it out. Derived here rather than fixed,
  // so a test that makes the OC partial gets the letter that goes with
  // it instead of one quietly describing a different certificate.
  const partial = (overrides.record as { type?: string } | undefined)?.type === "partial";
  const typeLabel = (overrides.typeLabel as string | undefined) || "Occupation Certificate";

  return {
    // The two letters, as getOcCertificateData resolves them. Ahead of
    // the spread so a test can still put its own words in — and present
    // at all because this fixture is cast, so a missing field is not a
    // type error here but a crash in whatever reads it.
    councilBody: [
      "Quality Private Certifiers Pty Ltd has issued an occupation certificate under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979 for the above premises, relying on CDC No. CDC-26091/01. Please find enclosed a copy for your records.",
    ],
    applicantBody: [
      `Enclosed is a copy of the issued ${typeLabel} for the subject development. One copy has been forwarded directly to Liverpool for their records.`,
      `Please retain this certificate, as it authorises ${partial ? "occupation and use of the part of the building described below" : "occupation and use of the building"}.`,
    ],
    job: {
      id: "job-1",
      address: "21 Coquet Way Green Valley",
      description: "Construction of a detached secondary dwelling",
      pathway: "CDC",
      details: {},
    },
    firm: neighbourFirm,
    record: {
      id: "oc-1",
      job_id: "job-1",
      type: "whole",
      description: null,
      generated_date: "2026-08-24",
      signed_at: "2026-08-24T00:00:00Z",
      approval_uploaded: false,
      approval_file_path: null,
    },
    issuedBy: { name: "Mohamad El Ghoul", registration_no: "BDC2961", registration_body: "Building Commission NSW", signature_url: null },
    approvedItems: [
      { id: "1", title: "Structural engineer's certificate", status: "approved", revision: "B", document_date: "2026-08-10", prepared_by: "Studio North", drawing_number: "SE-01" },
      { id: "2", title: "Waterproofing certificate", status: "approved", revision: null, document_date: null, prepared_by: "Aqua Seal", drawing_number: null },
    ],
    signatureUrl: null,
    uploadedApprovalUrl: null,
    logoUrl: null,
    ref: "OC-26001/01",
    projRef: "OC-26001",
    typeLabel: "Whole Occupation Certificate",
    consentRef: "CDC-26001/01",
    consentLabel: "CDC",
    daNumber: "",
    daDate: "",
    d: {
      council: { lga: "Liverpool City Council", address: { streetNumber: "50", street: "Scott Street", suburb: "Liverpool", state: "NSW", postcode: "2170" } },
      applicantAddress: { streetNumber: "21", street: "Coquet Way", suburb: "Green Valley", state: "NSW", postcode: "2168" },
      certificateDetails: { lotSectionDp: "9 / DP253031" },
      proposal: { classifications: ["Class 1a — Single dwelling"] },
    },
    issuedDate: "24 Aug 2026",
    applicantName: "Anh Cao",
    // The layout the certificate is drawn from. Before the spread, so a
    // test can hand in a layout of its own.
    template: DEFAULT_TEMPLATES.OC,
    ...overrides,
  } as unknown as OcCertificateData;
}
