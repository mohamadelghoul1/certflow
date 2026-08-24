import { Layout, MARGIN, MARGIN_BOTTOM, HEADER_TOP, A4, LETTER_BODY_SIZE, LETTER_SIGNATURE_NAME_SIZE, MUTED, LINE, HEADING_COLOR, INK, BODY_SIZE, SMALL_SIZE, TITLE_SIZE, SPACE_AFTER, LETTER_PARA_AFTER, INSPECTION_HEADER_FILL } from "@/lib/pdf/layout";
import { formatAddress, formatAddressLines, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatDocumentDate, formatISODate, letterheadAddressLines } from "@/lib/business";

// The CDC/CC certificate package as a PDF, mirroring
// lib/docx/pathwayCertificate.ts section for section: council letter,
// A letter's field labels are sentences, not the certificate's one-word
// "Applicant:", so they get a wider column to sit in.
const LETTER_LABEL_FRACTION = 0.42;

// applicant letter, certificate, mandatory inspections notice, Schedule 1
// and the documents-requested table.
//
// It exists so the approved set can be one PDF. The Word export stays
// exactly as it is — that's for editing; this is for handing over.

export type PackageImages = { logo?: { bytes: Uint8Array; type: "png" | "jpeg" } | null; signature?: { bytes: Uint8Array; type: "png" | "jpeg" } | null };

export async function buildCertificatePackagePdf(data: PathwayCertificateData, images: PackageImages): Promise<Uint8Array> {
  const {
    job,
    firm,
    issuedBy,
    conditions,
    allItems,
    selectedInspections,
    lapseDate,
    ref,
    projRef,
    isCdc,
    pathwayFull,
    d,
    cd,
    issuedDate,
    applicantName,
    applicantPhone,
    ownerName,
    ownerAddress,
    ownerPhone,
    councilBody,
    applicantBody,
    requiredDocsList,
  } = data;

  const l = await Layout.create();

  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;

  // Letterhead and footer are redrawn on every page, the way the section
  // header and footer work in the Word version.
  l.header = (layout) => {
    const top = A4[1] - HEADER_TOP;
    let leftBottom = top;

    if (logo) {
      const height = 34;
      const width = logo.width * (height / logo.height);
      layout.page.drawImage(logo, { x: MARGIN, y: top - height, width, height });
      leftBottom = top - height;
    } else {
      layout.page.drawText(firm?.name || "", { x: MARGIN, y: top - TITLE_SIZE, size: TITLE_SIZE, font: layout.bold, color: HEADING_COLOR });
      leftBottom = top - TITLE_SIZE - 3;
    }
    // The ABN and contact block read as the certificate's own small print
    // (SMALL_SIZE, 7pt) — noticeably smaller than everything else on the
    // page, including the field values just below it. Set at BODY_SIZE
    // instead, the same size the certificate's own fields use, so the
    // letterhead reads as part of the same document rather than a caption
    // under it. The footer below keeps SMALL_SIZE — that one is genuinely
    // meant to sit quietly under every page.
    const HEADER_DETAIL_SIZE = BODY_SIZE;
    layout.page.drawText(`ABN: ${firm?.abn || "—"}`, { x: MARGIN, y: leftBottom - HEADER_DETAIL_SIZE - 2, size: HEADER_DETAIL_SIZE, font: layout.regular, color: MUTED });

    const right: string[] = [];
    letterheadAddressLines(firm?.postal_address).forEach((line, i) => right.push(i === 0 ? `Postal: ${line}` : line));
    letterheadAddressLines(firm?.office_address).forEach((line, i) => right.push(i === 0 ? `Office: ${line}` : line));
    right.push(`(p): ${firm?.phone || "—"}`, `(e): ${firm?.email || "—"}`);
    const lead = HEADER_DETAIL_SIZE * 1.32;
    right.forEach((line, i) => {
      const w = layout.regular.widthOfTextAtSize(line, HEADER_DETAIL_SIZE);
      layout.page.drawText(line, { x: A4[0] - MARGIN - w, y: top - HEADER_DETAIL_SIZE - i * lead, size: HEADER_DETAIL_SIZE, font: layout.regular, color: MUTED });
    });

    const ruleY = Math.min(leftBottom - HEADER_DETAIL_SIZE - 10, top - HEADER_DETAIL_SIZE - right.length * lead - 4);
    layout.page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: A4[0] - MARGIN, y: ruleY }, thickness: 0.5, color: LINE });
    layout.y = ruleY - 14;
  };

  l.footer = (layout) => {
    const site = (firm?.website || "").trim();
    const label = site ? `Project No.: ${projRef}  ·  ${site}` : `Project No.: ${projRef}`;
    const y = MARGIN_BOTTOM - 12;
    layout.page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: A4[0] - MARGIN, y: y + 12 }, thickness: 0.5, color: LINE });
    const w = layout.regular.widthOfTextAtSize(label, SMALL_SIZE);
    layout.page.drawText(label, { x: (A4[0] - w) / 2, y, size: SMALL_SIZE, font: layout.regular, color: MUTED });
  };

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

  // 1. Council letter
  l.newPage();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock(["The General Manager", d.council?.lga || "Council", ...formatAddressLines(d.council?.address)], { size: LETTER_BODY_SIZE });
  l.text("Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  // The subject and its references, set the way the certificate sets its
  // own title and fields — a ruled heading, then right-aligned labels
  // against their values.
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${pathwayFull} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION);
  l.fieldRow(
    isCdc ? "Planning Instrument Decision Made Under:" : "Development Application No.:",
    (isCdc ? cd.relevantInstrument : cd.developmentConsentNumber) || "—",
    l.contentWidth * LETTER_LABEL_FRACTION
  );
  l.gap(4);
  councilBody.forEach((line) => l.text(line, { size: LETTER_BODY_SIZE, justify: true, letter: true, gapAfter: LETTER_PARA_AFTER }));
  l.documentTitle("ENCLOSED WITH THIS LETTER");
  l.bullet(`${pathwayFull} No. ${ref}`, { size: LETTER_BODY_SIZE });
  l.bullet(`Copy of the application for the ${pathwayFull}.`, { size: LETTER_BODY_SIZE });
  l.bullet(`Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`, { size: LETTER_BODY_SIZE });
  l.signatureRule();
  l.text("Yours sincerely,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  await signature();
  l.signatory(issuedBy?.name || "—", [`Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""} Pty Ltd`], { size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE });

  // 2. Applicant letter
  l.pageBreak();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock([applicantName || "", ...formatAddressLines(d.applicantAddress)], { size: LETTER_BODY_SIZE });
  l.text("Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${pathwayFull} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION);
  l.gap(4);
  l.text(`Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`, { bold: true, size: LETTER_BODY_SIZE, letter: true, gapAfter: 3 });
  applicantBody.forEach((line) => l.text(line, { size: LETTER_BODY_SIZE, justify: true, letter: true, gapAfter: LETTER_PARA_AFTER }));
  if (requiredDocsList.length) {
    l.callout("Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:", requiredDocsList, { size: LETTER_BODY_SIZE });
  }
  l.signatureRule();
  l.text("Yours sincerely,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  await signature();
  l.signatory(issuedBy?.name || "—", [`Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""} Pty Ltd`], { size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE });

  // 3. The certificate itself
  l.pageBreak();
  const issuedUnder = isCdc
    ? "Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979"
    : "Issued under Part 6 the Environmental Planning and Assessment Act 1979";
  l.documentTitle(isCdc ? `${pathwayFull} ${ref}`.toUpperCase() : `${pathwayFull} – ${projRef}`.toUpperCase(), {
    subtitle: isCdc ? [`PROJECT REFERENCE ${projRef}`, issuedUnder] : issuedUnder,
  });
  l.text(
    isCdc
      ? "This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF) has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been paid."
      : "This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been appointed.",
    { bold: true, gapAfter: 10 }
  );

  // Field for field the same certificate the Word export and the
  // on-screen copy produce. This section used to be its own arrangement —
  // different headings, a different title block, conditions set as a
  // full-width section rather than a row — which is why the same job came
  // out as a different document depending on which button was pressed.
  l.heading("APPLICANT DETAILS", { rule: true });
  l.fieldRow("Applicant:", applicantName || "");
  l.fieldRow("Address:", formatAddress(d.applicantAddress) || "");
  l.fieldRow("Phone:", applicantPhone || "");

  l.heading("OWNER DETAILS", { rule: true });
  l.fieldRow(isCdc ? "Owner" : "Owner:", ownerName || "");
  l.fieldRow("Address:", ownerAddress || "");
  l.fieldRow("Phone:", ownerPhone || "");

  if (isCdc) {
    l.heading(`${pathwayFull.toUpperCase()} DETAILS`, { rule: true });
    l.fieldRow("NSW Planning Portal Ref Number:", cd.planningPortalRef || "");
    l.fieldRow("Local Government Area:", d.council?.lga || "");
    l.fieldRow("Relevant Environmental Planning Instrument", cd.relevantInstrument || "");
    l.fieldRow("Relevant Part of Code", cd.relevantPartOfCode || "");
    l.fieldRow("Date of Determination:", formatISODate(cd.determinationDate));
    l.fieldRow("Date of Lapse:", /^\d{4}-\d{2}-\d{2}$/.test(lapseDate) ? formatISODate(lapseDate) : lapseDate);
  } else {
    l.heading("RELEVANT DEVELOPMENT CONSENTS", { rule: true });
    l.fieldRow("Consent Authority / Local Government Area:", d.council?.lga || "");
    l.fieldRow("Development Consent Number:", cd.developmentConsentNumber || "");
    l.fieldRow("Development Consent Date:", formatISODate(cd.developmentConsentDate));
    l.fieldRow("NSW Planning Portal Ref Number:", cd.planningPortalRef || "");
    l.fieldRow("Construction Certificate Number:", ref);
    l.fieldRow("Date of Issue of Construction Certificate:", issuedDate);
  }

  l.heading("PROPOSAL", { rule: true });
  l.fieldRow("Address of Development:", job.address || "");
  l.fieldRow(isCdc ? "Lot/Section/DP:" : "Lot/ DP:", cd.lotSectionDp || "");
  if (isCdc) l.fieldRow("Land Use Zone:", d.zoning || "");
  l.fieldRow(isCdc ? "BCA Classification/s:" : "BCA Classification:", formatClassifications(d.proposal?.classifications));
  l.fieldRow("BCA/NCC Version:", formatBcaVersion(d.bcaVersion, d.bcaVolumes));
  l.fieldRow("Description of Building Works:", job.description || "");
  l.fieldRow(isCdc ? "Value of Construction (incl. GST):" : "Value of Construction Certificate (incl. GST)", formatCurrency(d.proposal?.estimatedCost) || "");
  l.fieldRow(isCdc ? "Attachments" : "Attachments:", "Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon");

  if (isCdc) {
    // Conditions is a row of the same table, not a section of its own —
    // the label sits in the label column and everything it says lines up
    // under the values beside it.
    const labelWidth = l.contentWidth * 0.28;
    const valueX = MARGIN + labelWidth + 8;
    const valueWidth = l.contentWidth - labelWidth - 8;
    l.fieldRow(
      "Conditions:",
      "Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021"
    );
    l.text(
      "Any monetary contribution fee’s and/or any other Council fee’s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.",
      { x: valueX, width: valueWidth, justify: true, gapAfter: 3 }
    );
    conditions.forEach((c) => l.text(`\u2022  ${c.text}`, { x: valueX + 6, width: valueWidth - 6, gapAfter: 2 }));
  }
  l.fieldRow(isCdc ? "Critical stage inspections:" : "Critical Stage Inspections:", "See attached Notice");

  // The certifying block starts its own page, the way the on-screen
  // document does: who issued the certificate and on what authority reads
  // as one statement, and a certificate whose declaration and signature
  // are split across a page break reads as an error.
  l.pageBreak();
  l.heading("REGISTERED CERTIFIER", { rule: true, gapBefore: 0 });
  l.fieldRow("Registered Certifier:", issuedBy?.name || "");
  l.fieldRow("Registration Body:", issuedBy?.registration_body || "");
  l.fieldRow("Registration No:", issuedBy?.registration_no || "");
  l.gap(6);
  l.text(
    isCdc
      ? `I, ${issuedBy?.name || "—"}, certify that the development is complying development and (if carried out as specified in the certificate) will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation concerning the issue of the certificate.`
      : "I certify that building work completed in accordance with the documents accompanying the application for the certificate, including modifications verified by the certifier shown on the documents, will comply with the requirements referred to in the Act, Part 6.",
    { justify: true }
  );
  l.gap(4);
  l.text(`Dated:  ${issuedDate}`);
  await signature();
  l.signatory(issuedBy?.name || "—");
  l.gap(4);
  l.text(
    isCdc
      ? "N.B. Prior to the commencement of work section 6.6 of the Environment Planning and Assessment Act 1979 must be satisfied."
      : "N.B Prior to the commencement of work Sections 4.19, 6.6, 6.7, 6.12, 6.13, 6.14 of the Environment Planning and Assessment Act 1979 must be satisfied.",
    { bold: true }
  );

  // 4. Schedule 1 to the certificate: the documents it relies on.
  //    Sits directly under the certificate it belongs to, rather than at
  //    the back of the pack behind the inspections notice.
  l.pageBreak();
  l.documentTitle("SCHEDULE 1: APPROVED PLANS AND SPECIFICATIONS/ SUPPORTING DOCUMENTATION RELIED UPON", { subtitle: "Every document requested from the applicant during assessment, for reference." });
  l.table(
    ["Prepared by", "Document", "Reference no.", "Revision", "Date"],
    allItems.map((i) => [i.prepared_by || "—", i.title, i.drawing_number || "—", i.revision || "—", formatDocumentDate(i.document_date)]),
    [24, 33, 15, 12, 16],
    { zebra: true, rowHeight: 12 }
  );

  // 5. Mandatory inspections notice
  l.pageBreak();
  l.documentTitle("NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS", {
    subtitle: "Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58",
  });

  l.heading("APPLICANT DETAILS", { rule: true });
  l.fieldRow("Name of the person having benefit of the Development Consent:", applicantName || "");
  l.fieldRow("Address:", formatAddress(d.applicantAddress) || "");
  l.fieldRow("Phone:", applicantPhone || "");

  l.heading(isCdc ? "COMPLYING DEVELOPMENT CONSENTS" : "RELEVANT CONSENTS", { rule: true });
  l.fieldRow("Consent Authority / Local Government Area:", d.council?.lga || "");
  if (isCdc) {
    l.fieldRow("Decision Made Under:", cd.relevantInstrument || "");
    l.fieldRow("CDC Number:", ref);
  } else {
    l.fieldRow("Development Consent Number:", cd.developmentConsentNumber || "");
    l.fieldRow("Date Issued:", formatISODate(cd.developmentConsentDate));
    l.fieldRow("Construction Certificate Number:", ref);
  }

  l.heading("PROPOSAL", { rule: true });
  l.fieldRow("Address of Development:", job.address || "");
  l.fieldRow("Scope of Building Works Covered by this Notice:", job.description || "");

  l.heading("CERTIFICATION DETAILS", { rule: true });
  l.fieldRow("Certifying Authority:", issuedBy?.name || "");
  l.fieldRow("Registration Number:", issuedBy ? `${issuedBy.registration_body || ""} / ${issuedBy.registration_no || ""}` : "");

  l.gap(4);
  l.text(
    `I, ${issuedBy?.name || "—"} of ${firm?.name || ""} Pty Ltd, located at ${firm?.office_address || "—"}, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.`,
    { justify: true }
  );
  l.text(
    "The applicant, being the person having benefit of the development consent, is required under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to notify the principal contractor (if not an owner-builder) of the applicable mandatory critical stage inspections specified under this notice.",
    { justify: true }
  );
  l.text(
    "To allow a principal certifier or another certifying authority time to carry out mandatory critical stage inspections, the principal contractor for the building site, or the owner builder, must notify the principal certifier at least 48 hours before building work is commenced at the site if a mandatory critical stage inspection is required before the commencement of the work in accordance with Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021.",
    { justify: true }
  );
  l.text(
    "Failure to request a mandatory critical stage inspection will prohibit the principal certifier under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to issue an occupation certificate.",
    { bold: true, justify: true }
  );
  l.gap(2);
  l.text(`Dated: ${issuedDate}`, { align: "right" });
  await signature();
  l.signatory(issuedBy?.name || "—", [`Principal Certifier / ${issuedBy?.registration_no || "—"}`]);

  // 5b. Schedule 1 to the notice, on its own page
  l.pageBreak();
  l.documentTitle("SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS", { subtitle: `${pathwayFull} ${ref} — ${job.address || ""}` });
  l.table(
    ["No.", "Critical Stage Inspection", "Inspector"],
    selectedInspections.map((r, i) => [`${i + 1}.`, r.stage, r.inspector]),
    [8, 62, 30],
    { headerFill: INSPECTION_HEADER_FILL, centerColumns: [0], rowHeight: 17 }
  );

  return l.save();
}
