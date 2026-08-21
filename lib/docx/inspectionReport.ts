import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, pageBreak, splitRow, fieldTable, gridTable, headingRule, photoGrid, image, signatureUnderline, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR, type FieldRow } from "@/lib/docx/shared";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { formatISODate } from "@/lib/business";
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
    ? [new Paragraph({ children: [image(logo.buffer, logo.type, logo.width, logo.height)] }), p(`ABN: ${firm?.abn || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 })]
    : [p(firm?.name || "", { bold: true, size: 24, spacingAfter: 0 }), p(`ABN: ${firm?.abn || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 })];
  const right = [
    p(`Postal: ${firm?.postal_address || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`Office: ${firm?.office_address || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(p): ${firm?.phone || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(e): ${firm?.email || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
  ];
  return new Header({ children: [splitRow(left, right)] });
}

function projectFooter(certRef: string, website: string | null | undefined) {
  return new Footer({ children: [splitRow(`Project No.: ${certRef}`, website || "", { size: 16, color: MUTED_COLOR })] });
}

export async function buildInspectionReportDocx(data: InspectionReportData, images: { logo: ImageAsset | null; signature: ImageAsset | null; photos: (ImageAsset | null)[] }): Promise<Buffer> {
  const { job, firm, inspection, inspector, d, applicantName, certRef, certNumbers, consentRefLines } = data;

  const header = letterheadHeader(firm, images.logo);
  const footer = projectFooter(certRef, firm?.website);
  const children: FileChild[] = [];
  const push = (...items: FileChild[]) => children.push(...items);

  push(
    p(`INSPECTION REPORT – ${certRef} – ${inspection.title}`, { bold: true, size: 24, spacingAfter: 0 }),
    p(job.address || "", { color: MUTED_COLOR, spacingAfter: 200 }),

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

    p("INSPECTION RESULTS", { bold: true, spacingBefore: 200, spacingAfter: 20 }),
    p("We have attended the above property and completed an inspection. The areas inspected and the overall outcome of the inspection are listed below, together with any specific defects noted or documents required.", { size: 16, color: MUTED_COLOR, spacingAfter: 120 }),
    gridTable(["Inspection Area", "Inspection Outcome", "Reinspections"], [[`1. ${inspection.title}`, OUTCOME_TEXT[inspection.outcome] || "Pending", REINSPECTION_TEXT[inspection.outcome] || "No re-inspections required for this inspection."]], [30, 40, 30]),

    p("REQUIRED DOCUMENTS", { bold: true, spacingBefore: 200, spacingAfter: 20 })
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

  push(headingRule("SIGNED BY:"));
  if (images.signature) {
    push(new Paragraph({ children: [image(images.signature.buffer, images.signature.type, images.signature.width, images.signature.height)], spacing: { before: 120, after: 0 } }), signatureUnderline());
  } else {
    push(new Paragraph({ spacing: { before: 240, after: 0 } }), signatureUnderline());
  }
  push(p(`${inspector?.name || "—"} – Inspector`, { spacingAfter: 0 }), p(formatISODate(inspection.date), { color: MUTED_COLOR }));

  if (inspection.inspection_photos.length > 0) {
    push(
      pageBreak(),
      p("PHOTOGRAPHIC EVIDENCE", { bold: true, size: 24, spacingAfter: 20 }),
      p(`${inspection.title} – ${certRef}`, { color: MUTED_COLOR, spacingAfter: 200 }),
      photoGrid(
        inspection.inspection_photos.map((photo, i) => ({
          image: images.photos[i]
            ? new Paragraph({ children: [image(images.photos[i]!.buffer, images.photos[i]!.type, images.photos[i]!.width, images.photos[i]!.height)], spacing: { after: 40 } })
            : new Paragraph({ spacing: { after: 40 } }),
          caption: p(`${i + 1}. ${photo.caption || ""}`, { size: 16, color: MUTED_COLOR }),
        }))
      )
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
