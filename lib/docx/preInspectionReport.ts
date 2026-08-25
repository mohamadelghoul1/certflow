import { Document, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, fieldTable, gridTable, documentTitle, signatureBlock, PAGE_PROPERTIES, FONT, TEXT_COLOR, BODY_SIZE, INSPECTION_HEADER_FILL } from "@/lib/docx/shared";
import { letterheadHeader, projectFooter } from "@/lib/docx/pathwayCertificate";
import type { PreInspectionData } from "@/lib/certificates/preInspectionData";

// The pre-inspection report as a Word file — s139 for a CDC, s16 for a
// CC. Same letterhead, footer and field styling as the certificate it
// precedes, so the two read as one set.
export async function buildPreInspectionReportDocx(data: PreInspectionData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const header = letterheadHeader(data.firm, images.logo);
  const footer = projectFooter(data.projRef, data.firm?.website);

  const children: FileChild[] = [
    ...documentTitle(data.title, { subtitle: data.address }),
    fieldTable([
      { kind: "heading", text: "APPLICANT DETAILS" },
      { kind: "row", label: "Applicant:", value: data.applicantName },
      { kind: "row", label: "Address:", value: data.applicantAddress },
      { kind: "row", label: "Phone:", value: data.applicantPhone },

      { kind: "heading", text: data.isCdc ? "COMPLYING DEVELOPMENT CONSENTS" : "RELEVANT CONSENTS" },
      { kind: "row", label: "Local Government Area:", value: data.lga },
      // A CC is issued against a development application; a CDC has no
      // equivalent, so the row is left out rather than printed empty.
      ...(data.isCdc ? [] : [{ kind: "row" as const, label: "Development Applications (if applicable)", value: data.developmentConsentNumber }]),
      { kind: "row", label: data.certificateLabel, value: data.ref },
      { kind: "row", label: "Application Date", value: data.applicationDate },

      { kind: "heading", text: "PROPOSAL" },
      { kind: "row", label: "Address of Development:", value: data.address },
      { kind: "row", label: "Lot / DP:", value: data.lotSectionDp },
      { kind: "row", label: "Land Use Zoning:", value: data.zoning },
      { kind: "row", label: "Scope of Building Works Covered by this Notice:", value: data.scopeOfWorks },

      { kind: "heading", text: "INSPECTION DETAILS" },
      { kind: "row", label: "Inspector:", value: data.inspectorName },
      { kind: "row", label: "Inspection date:", value: data.inspectionDate },
      { kind: "row", label: "Registration No.:", value: data.registrationNo },
    ], { labelPct: 38 }),

    ...documentTitle("INSPECTION RESULTS"),
    p(
      "We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required.",
      { spacingAfter: 120 }
    ),
    gridTable(
      ["Inspection Area", "Inspection Outcome"],
      data.rows.map((row) => [row.area, row.outcome]),
      [72, 28],
      { headerFill: INSPECTION_HEADER_FILL, rowHeight: 300 }
    ),

    ...documentTitle("SIGNED BY:"),
    ...signatureBlock(images.signature),
    p(`${data.inspectorName || "—"} – Inspector`),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
