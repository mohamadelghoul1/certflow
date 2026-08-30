import { Layout, MARGIN, MARGIN_BOTTOM, HEADER_TOP, A4, LETTER_BODY_SIZE, LETTER_SIGNATURE_NAME_SIZE, MUTED, LINE, HEADING_COLOR, INK, BODY_SIZE, SMALL_SIZE, TITLE_SIZE, SPACE_AFTER, LETTER_PARA_AFTER, INSPECTION_HEADER_FILL } from "@/lib/pdf/layout";
import { formatAddress, formatAddressLines, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatDocumentDate, formatISODate } from "@/lib/business";
import { letterheadHeader, projectFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { drawPreInspectionReport, signPreInspectionReport } from "@/lib/pdf/preInspectionReport";
import type { PreInspectionData } from "@/lib/certificates/preInspectionData";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import type { FieldValues } from "@/lib/certificates/templateFields";
import { certificateFieldValues, conditionParagraphs } from "@/lib/certificates/certificateValues";

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

export type { PackageImages };

export async function buildCertificatePackagePdf(
  data: PathwayCertificateData,
  images: PackageImages,
  // The pre-inspection report, when the certifier has recorded the two
  // dates it needs. Null leaves the package exactly as it was, so a job
  // issued without one is unchanged.
  preInspection?: PreInspectionData | null
): Promise<Uint8Array> {
  const {
    template,
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
    docOverrides,
    applicantSalutation,
    councilSalutation,
    applicantIntro,
    applicantRequirementsIntro,
    applicantClosing,
  } = data;

  const l = await Layout.create();

  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;

  // Letterhead and footer are redrawn on every page, the way the section
  // header and footer work in the Word version. Shared with the
  // pre-inspection report that travels with this package.
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

  // 1. Council letter
  l.newPage();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock(["The General Manager", d.council?.lga || "Council", ...formatAddressLines(d.council?.address)], { size: LETTER_BODY_SIZE });
  l.text(councilSalutation || "Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  // The subject and its references, set the way the certificate sets its
  // own title and fields — a ruled heading, then right-aligned labels
  // against their values.
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${pathwayFull} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION, LETTER_BODY_SIZE);
  l.fieldRow(
    isCdc ? "Planning Instrument Decision Made Under:" : "Development Application No.:",
    (isCdc ? cd.relevantInstrument : cd.developmentConsentNumber) || "—",
    l.contentWidth * LETTER_LABEL_FRACTION,
    LETTER_BODY_SIZE
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
  l.signatory(issuedBy?.name || "—", [`Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""}`], { size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE });

  // 2. Applicant letter
  l.pageBreak();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.addressBlock([applicantName || "", ...formatAddressLines(d.applicantAddress)], { size: LETTER_BODY_SIZE });
  l.text(applicantSalutation || "Dear Sir/Madam,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  l.documentTitle(`RE: ${(job.address || "").toUpperCase()}`);
  l.fieldRow(`${pathwayFull} No.:`, ref, l.contentWidth * LETTER_LABEL_FRACTION, LETTER_BODY_SIZE);
  l.gap(4);
  l.text(applicantIntro || `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`, { bold: true, size: LETTER_BODY_SIZE, letter: true, gapAfter: 3 });
  applicantBody.forEach((line) => l.text(line, { size: LETTER_BODY_SIZE, justify: true, letter: true, gapAfter: LETTER_PARA_AFTER }));
  if (requiredDocsList.length) {
    l.callout(applicantRequirementsIntro || "Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:", requiredDocsList, { size: LETTER_BODY_SIZE });
  }
  l.signatureRule();
  l.text(applicantClosing || "Yours sincerely,", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  await signature();
  l.signatory(issuedBy?.name || "—", [`Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""}`], { size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE });

  // 3. The certificate itself
  l.pageBreak();
  const issuedUnder = isCdc
    ? "Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979"
    : "Issued under Part 6 the Environmental Planning and Assessment Act 1979";
  l.documentTitle(isCdc ? `${pathwayFull} ${ref}`.toUpperCase() : `${pathwayFull} – ${projRef}`.toUpperCase(), {
    subtitle: issuedUnder,
  });
  l.text(
    isCdc
      ? "This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF) has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been paid."
      : "This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been appointed.",
    // 4 rather than 10: the six points went to the foot of the page, which
    // is what lets the REGISTERED CERTIFIER block close the same page.
    { bold: true, gapAfter: 4 }
  );

  // Field for field the same certificate the Word export and the
  // on-screen copy produce. This section used to be its own arrangement —
  // different headings, a different title block, conditions set as a
  // full-width section rather than a row — which is why the same job came
  // out as a different document depending on which button was pressed.
  // A field the certifier corrected on the certificate itself wins over
  // the generated value, so the approved set says what the screen says.
  const ov = (key: string, value?: string | null) => (docOverrides || {})[`cert.${key}`] ?? value ?? "";

  // Every value the certificate can show, worked out once and shared
  // with the Word export so the two cannot say different things.
  const values = certificateFieldValues(data);

  const sections = resolveTemplate(template, values, pathwayFull);

  sections.forEach((section, index) => {
    // The last section is reserved whole rather than allowed to split: a
    // heading left behind on one page with its rows on the next is what
    // the first version of this did. 71 is the measured cost of the
    // block, and the 6pt lead-in on the sections above is what makes the
    // room for it.
    const last = index === sections.length - 1;
    if (last) l.ensure(71);
    l.heading(section.heading, { rule: true, gapBefore: last ? 0 : 6 });

    for (const row of section.rows) {
      if (row.kind === "conditions") {
        drawConditions(row.label);
        continue;
      }
      l.fieldRow(row.label, row.value);
    }
  });

  // Conditions is a row of the same table, not a section of its own — the
  // label sits in the label column and everything it says lines up under
  // the values beside it.
  function drawConditions(label: string) {
    const labelWidth = l.contentWidth * 0.28;
    const valueX = MARGIN + labelWidth + 8;
    const valueWidth = l.contentWidth - labelWidth - 8;
    // The PDF sets them all as paragraphs; only Word bullets a list.
    const conditionParas = conditionParagraphs(data).map((c) => c.text);
    l.fieldRow(label, conditionParas[0] || "");
    conditionParas.slice(1).forEach((para) => l.text(para, { x: valueX, width: valueWidth, justify: true, gapAfter: 3 }));
  }

  // The declaration and signature keep their own page.
  l.pageBreak();
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
  l.documentTitle("SCHEDULE 1: APPROVED PLANS AND SPECIFICATIONS/ SUPPORTING DOCUMENTATION RELIED UPON");
  l.table(
    ["Prepared by", "Document", "Reference no.", "Revision", "Date"],
    allItems.map((i) => [i.prepared_by || "—", i.title, i.drawing_number || "—", i.revision || "—", formatDocumentDate(i.document_date)]),
    [24, 33, 15, 12, 16],
    { zebra: true, rowHeight: 12 }
  );

  // 4b. Pre-inspection report — s139 for a CDC, s16 for a CC. It sits
  //     under the certificate and its Schedule 1, before the inspections
  //     notice, because it is what was found on site before the
  //     certificate was issued rather than part of the notice of what is
  //     still to be inspected.
  if (preInspection) {
    drawPreInspectionReport(l, preInspection);
    await signPreInspectionReport(l, preInspection, images.signature);
  }

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
  // From pathwayData, so a firm's own wording reaches the Word file too.
  for (const paragraph of data.inspectionsNotice) l.text(paragraph, { justify: true });
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
