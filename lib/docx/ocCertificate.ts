import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, pageBreak, splitRow, fieldTable, gridTable, image, signatureUnderline, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR } from "@/lib/docx/shared";
import type { OcCertificateData } from "@/lib/certificates/ocData";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { formatISODate } from "@/lib/business";

// Mirrors app/certificate/oc/[jobId]/[ocId]/page.tsx section-for-section.
// The council/applicant letters (sections 1-2) share the same logo
// letterhead as the pathway certificate; the OC certificate itself
// (section 3) has always used its own distinct, more formal letterhead
// (full firm name spelled out, reference in the corner) rather than that
// logo header — kept that way here too, as body content rather than a
// repeating page header, since a repeating header would otherwise show the
// wrong style on section 3's pages.

function letterheadHeader(firm: OcCertificateData["firm"], logo: ImageAsset | null) {
  const left = logo
    ? [new Paragraph({ children: [image(logo.buffer, logo.type, logo.width, logo.height)] }), p(`ABN: ${firm?.abn || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 })]
    : [p(firm?.name || "", { bold: true, size: 24, spacingAfter: 0 }), p(`ABN: ${firm?.abn || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 })];
  const right = [
    p(`Postal: ${firm?.postal_address || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`Office: ${firm?.office_address || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(p): ${firm?.phone || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(e): ${firm?.email || "—"}`, { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }),
  ];
  return splitRow(left, right);
}

function certificateHeader(firm: OcCertificateData["firm"], ref: string) {
  const left = [
    p(firm?.name || "", { bold: true, size: 28, spacingAfter: 0 }),
    p(`ABN ${firm?.abn || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 }),
    p(firm?.office_address || "—", { size: 16, color: MUTED_COLOR, spacingAfter: 0 }),
    p(`${firm?.phone || ""} · ${firm?.email || ""}`, { size: 16, color: MUTED_COLOR, spacingAfter: 0 }),
  ];
  const right = [p("Reference", { size: 16, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }), p(ref, { bold: true, align: AlignmentType.RIGHT, spacingAfter: 0 })];
  return splitRow(left, right, { leftPct: 60 });
}

function projectFooter(projRef: string, website: string | null | undefined) {
  return new Footer({ children: [splitRow(`Project No.: ${projRef}`, website || "", { size: 16, color: MUTED_COLOR })] });
}

function signatureBlock(signature: ImageAsset | null) {
  if (signature) {
    return [new Paragraph({ children: [image(signature.buffer, signature.type, signature.width, signature.height)], spacing: { before: 120, after: 0 } }), signatureUnderline()];
  }
  return [new Paragraph({ spacing: { before: 240, after: 0 } }), signatureUnderline()];
}

export async function buildOcCertificateDocx(data: OcCertificateData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const { job, firm, record, issuedBy, approvedItems, ref, projRef, typeLabel, consentRef, d, issuedDate, applicantName } = data;

  const footer = projectFooter(projRef, firm?.website);
  const children: FileChild[] = [];
  const push = (...items: FileChild[]) => children.push(...items);

  // 1. Council letter
  push(
    letterheadHeader(firm, images.logo),
    splitRow(`Our reference: ${projRef}`, issuedDate),
    p("The General Manager"),
    p(d.council?.lga || "Council"),
    p(formatAddress(d.council?.address)),
    p("Dear Sir/Madam,"),
    mixed([{ text: "Re: ", bold: true }, { text: job.address || "" }]),
    mixed([{ text: `${typeLabel} No.  `, bold: true }, { text: ref }]),
    p(`${firm?.name || ""} Pty Ltd has issued a ${typeLabel.toLowerCase()} under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979 for the above premises, relying on ${job.pathway} No. ${consentRef}. Please find enclosed a copy for your records.`),
    p("Yours sincerely,", { spacingBefore: 240 }),
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 16, color: MUTED_COLOR }),
    p(`${firm?.name || ""} Pty Ltd`, { size: 16, color: MUTED_COLOR })
  );

  // 2. Applicant/owner letter
  push(
    pageBreak(),
    letterheadHeader(firm, images.logo),
    splitRow(`Our reference: ${projRef}`, issuedDate),
    p(applicantName),
    p(formatAddress(d.applicantAddress)),
    p("Dear Sir/Madam,"),
    mixed([{ text: "Re: ", bold: true }, { text: job.address || "" }]),
    mixed([{ text: `${typeLabel} No.:  `, bold: true }, { text: ref }]),
    p(`Enclosed is a copy of the issued ${typeLabel} for the subject development. One copy has been forwarded directly to ${d.council?.lga || "Council"} for their records.`),
    p(`Please retain this certificate, as it authorises ${record.type === "whole" ? "occupation and use of the building" : "occupation and use of the part of the building described below"}.`),
    p("Yours sincerely,", { spacingBefore: 240 }),
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 16, color: MUTED_COLOR }),
    p(`${firm?.name || ""} Pty Ltd`, { size: 16, color: MUTED_COLOR })
  );

  // 3. Occupation Certificate & schedule
  push(
    pageBreak(),
    certificateHeader(firm, ref),
    p(typeLabel.toUpperCase(), { bold: true, size: 32, align: AlignmentType.CENTER, spacingBefore: 200, spacingAfter: 40 }),
    p("Issued under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979", { size: 16, color: MUTED_COLOR, align: AlignmentType.CENTER, spacingAfter: 200 }),
    fieldTable([
      { kind: "row", label: "Property address", value: job.address },
      { kind: "row", label: "Lot/Section/DP", value: d.certificateDetails?.lotSectionDp },
      { kind: "row", label: "Development description", value: record.description || job.description },
      { kind: "row", label: "Building classification(s)", value: (d.proposal?.classifications || []).join(", ") },
      { kind: "row", label: `${job.pathway} relied upon`, value: consentRef },
      { kind: "row", label: "Date of issue", value: issuedDate },
    ]),
    p("Documents relied upon", { bold: true, size: 16, uppercase: true, spacingBefore: 200, spacingAfter: 80 }),
    approvedItems.length > 0
      ? gridTable(
          ["Document", "Revision", "Document date", "Prepared by"],
          approvedItems.map((item) => [item.title, item.revision || "—", formatISODate(item.document_date), item.prepared_by || "—"]),
          [40, 20, 20, 20]
        )
      : p("No approved documents.", { color: MUTED_COLOR }),
    p("Certifying authority", { size: 16, color: MUTED_COLOR, uppercase: true, spacingBefore: 300, spacingAfter: 20 }),
    p(issuedBy?.name || "—", { bold: true, spacingAfter: 0 }),
    p(`${issuedBy?.registration_no || "—"} · ${issuedBy?.registration_body || "—"}`, { color: MUTED_COLOR, spacingAfter: 0 }),
    p(`Issued ${issuedDate}`, { color: MUTED_COLOR })
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
