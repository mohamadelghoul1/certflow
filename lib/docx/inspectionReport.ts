import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, pageBreak, splitRow, fieldTable, gridTable, headingRule, photoGrid, image, signatureBlock, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR, type FieldRow, ruleLine, footerLine, documentTitle, SMALL_SIZE, TITLE_SIZE, HEADING_COLOR, SECTION_GAP, INSPECTION_HEADER_FILL, BODY_SIZE, signatory } from "@/lib/docx/shared";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { formatISODate, letterheadAddressLines } from "@/lib/business";
import type { InspectionReportData } from "@/lib/certificates/inspectionReportData";

// Mirrors app/jobs/[jobId]/inspections/[inspectionId]/report/page.tsx.

const OUTCOME_TEXT: Record<string, string> = {
  passed: "Satisfactory — no issues identified",
  passed_subject_to: "Satisfactory (minor issues) subject to documents/conditions being provided",
  failed: "Unsatisfactory — see required documents below",
  pending: "Pending",
};
const REINSPECTION_TEXT: Record<string, string> = {
  failed: "Re-inspection required",
  passed_subject_to: "No re-inspection required, subject to documents/conditions being provided",
};

// The on-screen CertRow skips a field entirely when it has no value,
// rather than showing "—" — this report reads as a checklist of what's
// actually on file, unlike the certificates (which always show every
// field, blank or not, since a certificate is a fixed legal form).
function rows(...items: (FieldRow | null)[]): FieldRow[] {
  return items.filter((r): r is FieldRow => r !== null && (r.kind === "heading" || !!r.value || (r.children?.length ?? 0) > 0));
}

function letterheadHeader(firm: InspectionReportData["firm"], logo: ImageAsset | null) {
  const left = logo
    ? [new Paragraph({ children: [image(logo.buffer, logo.type, logo.width, logo.height)] }), p(`ABN: ${firm?.abn || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0 })]
    : [p(firm?.name || "", { bold: true, size: TITLE_SIZE, color: HEADING_COLOR, spacingAfter: 0 }), p(`ABN: ${firm?.abn || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0 })];
  const right = [
    ...letterheadAddressLines(firm?.postal_address).map((line, i) => p(i === 0 ? `Postal: ${line}` : line, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    ...letterheadAddressLines(firm?.office_address).map((line, i) => p(i === 0 ? `Office: ${line}` : line, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    p(`(p): ${firm?.phone || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(e): ${firm?.email || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
  ];
  return new Header({ children: [splitRow(left, right), ruleLine()] });
}

function projectFooter(certRef: string, website: string | null | undefined) {
  return new Footer({ children: [footerLine(`Project No.: ${certRef}`, website)] });
}

export async function buildInspectionReportDocx(data: InspectionReportData, images: { logo: ImageAsset | null; signature: ImageAsset | null; photos: (ImageAsset | null)[] }): Promise<Buffer> {
  const { job, firm, inspection, inspector, d, applicantName, certRef, certNumbers, consentRefLines, introText, notes } = data;

  const header = letterheadHeader(firm, images.logo);
  const footer = projectFooter(certRef, firm?.website);
  const children: FileChild[] = [];
  const push = (...items: FileChild[]) => children.push(...items);

  push(
    ...documentTitle(`INSPECTION REPORT – ${certRef} – ${inspection.title}`, { subtitle: job.address || "" }),

    headingRule("APPLICANT DETAILS"),
    fieldTable(rows({ kind: "row", label: "Applicant:", value: applicantName }, { kind: "row", label: "Address:", value: formatAddress(d.applicantAddress) }, { kind: "row", label: "Phone:", value: d.contact?.phone || d.contact?.mobile }, { kind: "row", label: "Email:", value: d.contact?.email })),

    headingRule("RELEVANT CONSENTS"),
    fieldTable(
      rows(
        { kind: "row", label: "Local Government Area:", value: d.council?.lga },
        consentRefLines.length ? { kind: "row", label: "Development Applications (if applicable):", children: consentRefLines.map((l) => p(l, { spacingAfter: 0 })) } : null,
        { kind: "row", label: `${job.pathway === "CDC" ? "Complying Development Certificate" : "Construction Certificate"} Number`, value: certNumbers }
      )
    ),

    headingRule("PROPOSAL"),
    fieldTable(rows({ kind: "row", label: "Address of Development:", value: job.address }, { kind: "row", label: "Lot / DP:", value: d.certificateDetails?.lotSectionDp }, { kind: "row", label: "Land Use Zoning:", value: d.zoning }, { kind: "row", label: "Scope of Building Works Covered by this Notice:", value: job.description })),

    headingRule("INSPECTION DETAILS"),
    fieldTable(rows({ kind: "row", label: "Inspector:", value: inspector?.name }, { kind: "row", label: "Inspection date:", value: formatISODate(inspection.date) }, { kind: "row", label: "Registration No.:", value: inspector?.registration_no })),

    headingRule("INSPECTION RESULTS"),
    p(introText, { size: SMALL_SIZE, color: MUTED_COLOR, spacingAfter: 120 }),
    gridTable(
      ["Inspection Area", "Inspection Outcome", "Reinspections"],
      [[`1. ${inspection.title}`, OUTCOME_TEXT[inspection.outcome] || "Pending", REINSPECTION_TEXT[inspection.outcome] || "No re-inspections required for this inspection."]],
      [30, 40, 30],
      { headerFill: INSPECTION_HEADER_FILL, rowHeight: 460 }
    ),

    headingRule("REQUIRED DOCUMENTS")
  );

  if (inspection.defects.length === 0) {
    push(p("No further documents are required.", { italic: true, color: MUTED_COLOR }));
  } else {
    inspection.defects.forEach((defect, i) => {
      push(
        mixed([{ text: `${i + 1}.  ${defect.text} — ` }, defect.resolved ? { text: "Resolved", bold: true, color: "059669" } : { text: "Required", bold: true, color: "B45309" }], { spacingAfter: 60 })
      );
    });
  }

  if (notes) {
    push(headingRule("NOTES"), p(notes, { spacingAfter: 60 }));
  }

  push(headingRule("SIGNED BY:"), ...signatureBlock(images.signature));
  push(...signatory(`${inspector?.name || "—"} – Inspector`, formatISODate(inspection.date)));

  if (inspection.inspection_photos.length > 0) {
    push(
      pageBreak(),
      ...documentTitle("PHOTOGRAPHIC EVIDENCE", { subtitle: `${inspection.title} – ${certRef}` }),
      photoGrid(
        inspection.inspection_photos.map((photo, i) => ({
          image: images.photos[i]
            ? new Paragraph({ children: [image(images.photos[i]!.buffer, images.photos[i]!.type, images.photos[i]!.width, images.photos[i]!.height)], spacing: { after: 40 } })
            : new Paragraph({ spacing: { after: 40 } }),
          caption: p(`${i + 1}. ${photo.caption || ""}`, { size: SMALL_SIZE, color: MUTED_COLOR }),
        }))
      )
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
