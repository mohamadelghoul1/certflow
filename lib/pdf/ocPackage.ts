import { Layout, MARGIN, A4, LETTER_BODY_SIZE, LETTER_SIGNATURE_NAME_SIZE, LETTER_PARA_AFTER, INK, MUTED } from "@/lib/pdf/layout";
import { letterheadHeader, projectFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { formatAddressLines } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatDocumentDate } from "@/lib/business";
import type { OcCertificateData } from "@/lib/certificates/ocData";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import { ocFieldValues } from "@/lib/certificates/certificateValues";

// The Occupation Certificate package as a PDF, mirroring
// lib/docx/ocCertificate.ts section for section: council letter,
// applicant letter, the certificate itself and the documents it relies
// on.
//
// It exists for the same reason the CDC/CC package has a PDF twin — the
// combined set has to be one PDF, and a Word file cannot be merged into
// one without software this doesn't have. The Word export is untouched:
// that one is for editing before it goes out, this one is for handing
// over.

// A letter's field labels are sentences rather than the certificate's
// one-word "Applicant:", so they get a wider column, exactly as the
// CDC/CC package sets them.
const LETTER_LABEL_FRACTION = 0.42;

export async function buildOcPackagePdf(data: OcCertificateData, images: PackageImages): Promise<Uint8Array> {
  const { job, firm, record, issuedBy, approvedItems, ref, projRef, typeLabel, consentRef, consentLabel, daNumber, daDate, d, issuedDate, applicantName } = data;

  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.header = letterheadHeader(firm, logo);
  l.footer = projectFooter(projRef, firm?.website);

  const splitLine = (left: string, right: string) => {
    l.ensure(14);
    l.y -= 12;
    l.page.drawText(left, { x: MARGIN, y: l.y, size: LETTER_BODY_SIZE, font: l.regular, color: INK });
    const w = l.regular.widthOfTextAtSize(right, LETTER_BODY_SIZE);
    l.page.drawText(right, { x: A4[0] - MARGIN - w, y: l.y, size: LETTER_BODY_SIZE, font: l.regular, color: INK });
    l.y -= 6;
  };

  const signature = async () => {
    if (images.signature) await l.image(images.signature.bytes, images.signature.type, 42);
    else l.gap(34);
  };

  const closing = async () => {
    l.signatureRule();
    l.text("Yours sincerely,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
    await signature();
    l.signatory(issuedBy?.name || "—", [`Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""}`], {
      size: LETTER_BODY_SIZE,
      nameSize: LETTER_SIGNATURE_NAME_SIZE,
    });
  };

  const body = (text: string) => l.text(text, { size: LETTER_BODY_SIZE, justify: true, letter: true, gapAfter: LETTER_PARA_AFTER });

  // 1. Council letter
  l.newPage();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock(["The General Manager", d.council?.lga || "Council", ...formatAddressLines(d.council?.address)], { size: LETTER_BODY_SIZE });
  l.text("Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${typeLabel} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION, LETTER_BODY_SIZE);
  l.gap(4);
  body(
    `${firm?.name || ""} has issued a ${typeLabel.toLowerCase()} under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979 for the above premises, relying on ${consentLabel} No. ${consentRef}${
      daNumber ? `, issued under Development Consent No. ${daNumber}` : ""
    }. Please find enclosed a copy for your records.`
  );
  await closing();

  // 2. Applicant / owner letter
  l.pageBreak();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock([applicantName || "", ...formatAddressLines(d.applicantAddress)], { size: LETTER_BODY_SIZE });
  l.text("Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${typeLabel} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION, LETTER_BODY_SIZE);
  l.gap(4);
  body(`Enclosed is a copy of the issued ${typeLabel} for the subject development. One copy has been forwarded directly to ${d.council?.lga || "Council"} for their records.`);
  body(
    `Please retain this certificate, as it authorises ${
      record.type === "whole" ? "occupation and use of the building" : "occupation and use of the part of the building described below"
    }.`
  );
  await closing();

  // 3. The certificate itself
  l.pageBreak();
  l.documentTitle(typeLabel.toUpperCase(), {
    subtitle: ["Issued under Part 6 Division 3 of the Environmental Planning and Assessment Act 1979", `Certificate No.: ${ref}`],
    center: true,
  });
  // The firm's layout where they have one, ours otherwise. A CDC job has
  // no development consent behind it, and the rows that would carry one
  // drop out rather than printing a label with nothing beside it.
  for (const section of resolveTemplate(data.template, ocFieldValues(data), typeLabel, consentLabel)) {
    if (section.heading) l.heading(section.heading, { rule: true, gapBefore: 6 });
    for (const row of section.rows) l.fieldRow(row.label, row.value);
  }

  l.heading("DOCUMENTS RELIED UPON", { rule: true, gapBefore: 6 });
  if (approvedItems.length > 0) {
    l.table(
      ["Prepared by", "Document", "Reference no.", "Revision", "Date"],
      approvedItems.map((item) => [item.prepared_by || "—", item.title, item.drawing_number || "—", item.revision || "—", formatDocumentDate(item.document_date)]),
      [20, 32, 18, 13, 17],
      { zebra: true, rowHeight: 12 }
    );
  } else {
    l.text("No approved documents.", { color: MUTED });
  }

  l.heading("CERTIFYING AUTHORITY", { rule: true, gapBefore: 6 });
  await signature();
  l.signatory(issuedBy?.name || "—", [`${issuedBy?.registration_no || "—"} · ${issuedBy?.registration_body || "—"}`, `Issued ${issuedDate}`]);

  return l.save();
}
