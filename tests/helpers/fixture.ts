import type { PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { epiForCodeParts } from "@/lib/constants";

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
      name: "Quality Private Certifiers",
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
    ...overrides,
  } as unknown as PathwayCertificateData;
}
