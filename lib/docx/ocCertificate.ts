import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, pageBreak, splitRow, fieldTable, gridTable, image, signatureBlock, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR, ruleLine, footerLine, documentTitle, SMALL_SIZE, TITLE_SIZE, HEADING_COLOR, SECTION_GAP, INSPECTION_HEADER_FILL, headingRule, BODY_SIZE, signatureRule, signatory } from "@/lib/docx/shared";
import type { OcCertificateData } from "@/lib/certificates/ocData";
import { formatAddress } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatDocumentDate, formatISODate, letterheadAddressLines } from "@/lib/business";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import { ocFieldValues } from "@/lib/certificates/certificateValues";

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
    ? [new Paragraph({ children: [image(logo.buffer, logo.type, logo.width, logo.height)] }), p(`ABN: ${firm?.abn || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0 })]
    : [p(firm?.name || "", { bold: true, size: TITLE_SIZE, color: HEADING_COLOR, spacingAfter: 0 }), p(`ABN: ${firm?.abn || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0 })];
  const right = [
    ...letterheadAddressLines(firm?.postal_address).map((line, i) => p(i === 0 ? `Postal: ${line}` : line, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    ...letterheadAddressLines(firm?.office_address).map((line, i) => p(i === 0 ? `Office: ${line}` : line, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    p(`(p): ${firm?.phone || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(e): ${firm?.email || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
  ];
  return splitRow(left, right);
}

function certificateHeader(firm: OcCertificateData["firm"], ref: string) {
  const left = [
    p(firm?.name || "", { bold: true, size: 28, spacingAfter: 0 }),
    p(`ABN ${firm?.abn || "—"}`, { size: SMALL_SIZE, color: MUTED_COLOR, spacingAfter: 0 }),
    p(firm?.office_address || "—", { size: SMALL_SIZE, color: MUTED_COLOR, spacingAfter: 0 }),
    p(`${firm?.phone || ""} · ${firm?.email || ""}`, { size: SMALL_SIZE, color: MUTED_COLOR, spacingAfter: 0 }),
  ];
  const right = [p("Reference", { size: SMALL_SIZE, color: MUTED_COLOR, align: AlignmentType.RIGHT, spacingAfter: 0 }), p(ref, { bold: true, align: AlignmentType.RIGHT, spacingAfter: 0 })];
  return splitRow(left, right, { leftPct: 60 });
}

function projectFooter(projRef: string, website: string | null | undefined) {
  return new Footer({ children: [footerLine(`Project No.: ${projRef}`, website)] });
}


export async function buildOcCertificateDocx(data: OcCertificateData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const { job, firm, record, issuedBy, approvedItems, ref, projRef, typeLabel, consentRef, consentLabel, daNumber, daDate, d, issuedDate, applicantName } = data;

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
    // The consent number goes in the letter, its dates do not — the
    // council files against the number.
    p(
      `${firm?.name || ""} Pty Ltd has issued a ${typeLabel.toLowerCase()} under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979 for the above premises, relying on ${consentLabel} No. ${consentRef}${daNumber ? `, issued under Development Consent No. ${daNumber}` : ""}. Please find enclosed a copy for your records.`
    ),
    signatureRule(),
    p("Yours sincerely,", { spacingBefore: 120 }),
    ...signatureBlock(images.signature),
    ...signatory(issuedBy?.name, `Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""} Pty Ltd`)
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
    signatureRule(),
    p("Yours sincerely,", { spacingBefore: 120 }),
    ...signatureBlock(images.signature),
    ...signatory(issuedBy?.name, `Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""} Pty Ltd`)
  );

  // 3. Occupation Certificate & schedule
  push(
    pageBreak(),
    certificateHeader(firm, ref),
    ...documentTitle(typeLabel, {
      uppercase: true,
      center: true,
      subtitle: "Issued under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979",
    }),
    // The same layout the PDF walks, so a firm's Word copy and their PDF
    // of one certificate can only differ if the layout does. The labels
    // carry their own punctuation, which is why the trailing colons that
    // used to be added here are now part of the label itself.
    fieldTable(
      resolveTemplate(data.template, ocFieldValues(data), typeLabel, consentLabel).flatMap((section) => [
        ...(section.heading ? [{ kind: "heading" as const, text: section.heading }] : []),
        ...section.rows.map((row) => ({ kind: "row" as const, label: row.label, value: row.value })),
      ]),
    ),
    headingRule("DOCUMENTS RELIED UPON"),
    approvedItems.length > 0
      ? gridTable(
          ["Prepared by", "Document", "Reference no.", "Revision", "Date"],
          approvedItems.map((item) => [item.prepared_by || "—", item.title, item.drawing_number || "—", item.revision || "—", formatDocumentDate(item.document_date)]),
          [20, 32, 18, 13, 17],
          { zebra: true, rowHeight: 300 }
        )
      : p("No approved documents.", { color: MUTED_COLOR }),
    headingRule("CERTIFYING AUTHORITY"),
    ...signatory(issuedBy?.name, `${issuedBy?.registration_no || "—"} · ${issuedBy?.registration_body || "—"}`, `Issued ${issuedDate}`)
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
