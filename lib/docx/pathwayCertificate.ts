import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import type { Letterhead } from "@/lib/letterhead";
import { p, mixed, bullet, pageBreak, splitRow, fieldTable, gridTable, calloutBox, image, signatureBlock, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR, ruleLine, footerLine, documentTitle, SMALL_SIZE, TITLE_SIZE, HEADING_COLOR, SECTION_GAP, INSPECTION_HEADER_FILL, BODY_SIZE, signatureRule, signatory, addressBlock, LETTER_PARA_AFTER, LETTER_LINE_SPACING, TIGHT_LINE_SPACING, LETTER_BODY_SIZE, LETTER_SIGNATURE_NAME_SIZE } from "@/lib/docx/shared";
import { formatAddress, formatAddressLines, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatClassifications, formatDocumentDate, formatISODate, letterheadAddressLines } from "@/lib/business";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import { certificateFieldValues, conditionParagraphs } from "@/lib/certificates/certificateValues";

// A letter's field labels are sentences, not the certificate's one-word
// "Applicant:", so they get a wider column to sit in. At the letter's
// 11pt the longest label plus the longest value no longer fit one line
// between them, so something has to wrap — and it should be the label,
// the way the certificate's own long labels wrap, never the value: a
// year stranded alone under "State Environmental Planning Policy
// (Housing)" reads as a mistake. 40% gives values the room — measured
// from the render: the longest value needs ~290pt of the ~516pt line —
// and lets the labels fold right-aligned the way the certificate's own
// long labels do. The PDF keeps its own 42% — its Helvetica runs
// narrower and everything fits on one line there.
const LETTER_LABEL_PCT = 40;

// Mirrors app/certificate/pathway/[jobId]/page.tsx section-for-section, so
// any change to the real document content only needs to happen once in
// lib/certificates/pathwayData.ts — this file only handles how that same
// data is laid out as native Word paragraphs/tables instead of JSX.

// The ABN and contact block used to be set at SMALL_SIZE (7pt) — the same
// caption size as the page footer, and noticeably smaller than the
// certificate's own field values just below it. Set at BODY_SIZE instead,
// matching those fields, so the letterhead reads as part of the same
// document rather than a caption under it.
const HEADER_DETAIL_SIZE = BODY_SIZE;

// Takes a letterhead rather than a firm: an inspection carried out by a
// contract certifier goes out on their practice's, not the firm's.
export function letterheadHeader(firm: Letterhead | null, logo: ImageAsset | null) {
  const left = logo
    ? [new Paragraph({ children: [image(logo.buffer, logo.type, logo.width, logo.height)] }), p(`ABN: ${firm?.abn || "—"}`, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0, lineSpacing: TIGHT_LINE_SPACING })]
    : [p(firm?.name || "", { bold: true, size: TITLE_SIZE, color: HEADING_COLOR, spacingAfter: 0 }), p(`ABN: ${firm?.abn || "—"}`, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, spacingAfter: 0, lineSpacing: TIGHT_LINE_SPACING })];
  const right = [
    ...letterheadAddressLines(firm?.postal_address).map((line, i) => p(i === 0 ? `Postal: ${line}` : line, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    ...letterheadAddressLines(firm?.office_address).map((line, i) => p(i === 0 ? `Office: ${line}` : line, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 })),
    p(`(p): ${firm?.phone || "—"}`, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
    p(`(e): ${firm?.email || "—"}`, { size: HEADER_DETAIL_SIZE, color: MUTED_COLOR, light: true, align: AlignmentType.RIGHT, spacingAfter: 0 }),
  ];
  return new Header({ children: [splitRow(left, right), ruleLine()] });
}

export function projectFooter(projRef: string, website: string | null | undefined) {
  return new Footer({ children: [footerLine(`Project No.: ${projRef}`, website)] });
}

export async function buildPathwayCertificateDocx(data: PathwayCertificateData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const { job, firm, issuedBy, conditions, allItems, selectedInspections, lapseDate, ref, projRef, isCdc, pathwayFull, d, cd, issuedDate, applicantName, applicantPhone, ownerName, ownerAddress, ownerPhone, councilBody, applicantBody, requiredDocsList, applicantSalutation, councilSalutation, applicantIntro, applicantRequirementsIntro, applicantClosing, docOverrides } = data;
  // A field the certifier corrected on the certificate itself wins over
  // the generated value, so the Word copy says what the screen says.
  const ov = (key: string, value?: string | null) => (docOverrides || {})[`cert.${key}`] ?? value;

  // The firm's layout, resolved once. The last section is drawn on its
  // own so Word keeps it whole rather than splitting a certifier's name
  // from their registration number across a page.
  const resolvedSections = resolveTemplate(data.template, certificateFieldValues(data), pathwayFull);
  const certificateSections = resolvedSections;
  const closingSection = resolvedSections[resolvedSections.length - 1];

  const salutationApplicant = applicantSalutation || "Dear Sir/Madam,";
  const salutationCouncil = councilSalutation || "Dear Sir/Madam,";
  const introApplicant = applicantIntro || `Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`;
  const closingApplicant = applicantClosing || "Yours sincerely,";


  const header = letterheadHeader(firm, images.logo);
  const footer = projectFooter(projRef, firm?.website);
  const children: FileChild[] = [];
  const push = (...items: FileChild[]) => children.push(...items);

  // 1. Council letter
  push(
    splitRow(`Our reference: ${projRef}`, issuedDate, { size: LETTER_BODY_SIZE }),
    ...addressBlock(["The General Manager", d.council?.lga || "Council", ...formatAddressLines(d.council?.address)], { size: LETTER_BODY_SIZE }),
    p(salutationCouncil, { size: LETTER_BODY_SIZE, spacingAfter: 60 }),
    // The subject and its references, set the way the certificate sets its
    // own title and fields: a ruled heading, then right-aligned labels
    // against their values. Run on as bold-lead paragraphs they were three
    // ragged lines of small print at the top of a letter.
    ...documentTitle(`RE: ${job.address || ""}`, { uppercase: true }),
    fieldTable(
      [
        { kind: "row", label: `${pathwayFull} No.:`, value: ref },
        isCdc
          ? { kind: "row" as const, label: "Planning Instrument Decision Made Under:", value: cd.relevantInstrument || "—" }
          : { kind: "row" as const, label: "Development Application No.:", value: cd.developmentConsentNumber || "—" },
      ],
      { labelPct: LETTER_LABEL_PCT, size: LETTER_BODY_SIZE }
    ),
    p("", { size: 10, spacingAfter: 0 }),
    ...councilBody.map((para) => p(para, { size: LETTER_BODY_SIZE, justify: true, spacingAfter: LETTER_PARA_AFTER, lineSpacing: LETTER_LINE_SPACING })),
    ...documentTitle("ENCLOSED WITH THIS LETTER"),
    bullet(`${pathwayFull} No. ${ref}`, { size: LETTER_BODY_SIZE }),
    bullet(`Copy of the application for the ${pathwayFull}.`, { size: LETTER_BODY_SIZE }),
    bullet(`Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`, { size: LETTER_BODY_SIZE }),
    signatureRule(),
    p("Yours sincerely,", { size: LETTER_BODY_SIZE, spacingBefore: 120 }),
    ...signatureBlock(images.signature),
    ...signatory({ size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE }, issuedBy?.name, `Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""}`)
  );

  // 2. Applicant letter
  push(
    pageBreak(),
    splitRow(`Our reference: ${projRef}`, issuedDate, { size: LETTER_BODY_SIZE }),
    ...addressBlock([applicantName, ...formatAddressLines(d.applicantAddress)], { size: LETTER_BODY_SIZE }),
    p(salutationApplicant, { size: LETTER_BODY_SIZE, spacingAfter: 60 }),
    ...documentTitle(`RE: ${job.address || ""}`, { uppercase: true }),
    fieldTable([{ kind: "row", label: `${pathwayFull} No.:`, value: ref }], { labelPct: LETTER_LABEL_PCT, size: LETTER_BODY_SIZE }),
    p("", { size: 10, spacingAfter: 0 }),
    p(introApplicant, { bold: true, size: LETTER_BODY_SIZE, lineSpacing: LETTER_LINE_SPACING }),
    ...applicantBody.map((para) => p(para, { size: LETTER_BODY_SIZE, justify: true, spacingAfter: LETTER_PARA_AFTER, lineSpacing: LETTER_LINE_SPACING })),
    calloutBox([
      p("Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:", { size: LETTER_BODY_SIZE, spacingAfter: 60 }),
      ...requiredDocsList.map((item) => bullet(item, { size: LETTER_BODY_SIZE })),
    ]),
    signatureRule(),
    p(closingApplicant, { size: LETTER_BODY_SIZE, spacingBefore: 120 }),
    ...signatureBlock(images.signature),
    ...signatory({ size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE }, issuedBy?.name, `Registered Certifier / ${issuedBy?.registration_no || "—"}`, `${firm?.name || ""}`)
  );

  // 3. Certificate
  // The Act the certificate is issued under belongs inside the title's
  // ruled block with the project reference — set below the rule it read as
  // stray small print floating between the title and the certificate.
  const issuedUnder = isCdc
    ? "Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979"
    : "Issued under Part 6 the Environmental Planning and Assessment Act 1979";
  const certTitle = isCdc
    ? documentTitle(`${pathwayFull} ${ref}`, { uppercase: true, subtitle: issuedUnder })
    : documentTitle(`${pathwayFull} – ${projRef}`, { uppercase: true, subtitle: issuedUnder });
  push(
    pageBreak(),
    ...certTitle,
    p(
      isCdc
        ? "This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF) has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been paid."
        : "This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been appointed.",
      { bold: true, spacingAfter: 150 }
    ),
    fieldTable([
      // Every section but the last, drawn from the firm's template —
      // the same one the PDF walks, so the two exports of one job can
      // only differ if the template does.
      ...certificateSections.slice(0, -1).flatMap((section) => [
        { kind: "heading" as const, text: section.heading },
        ...section.rows.map((row) =>
          row.kind === "conditions"
            ? {
                kind: "row" as const,
                label: row.label,
                children: conditionParagraphs(data).map((para) =>
                  para.bulleted ? bullet(para.text) : p(para.text, { spacingAfter: 30 }),
                ),
              }
            : { kind: "row" as const, label: row.label, value: row.value },
        ),
      ]),
    ]),
    // Who the certificate is issued by, on the same page as what it
    // covers — dropping the project-reference subtitle freed the room. Its
    // own keep-together table, so if a long conditions list ever pushes it
    // off, Word moves the whole block rather than splitting the
    // certifier's name from their registration. The declaration and
    // signature keep their own page.
    fieldTable(
      [
        { kind: "heading" as const, text: closingSection.heading },
        ...closingSection.rows.map((row) => ({ kind: "row" as const, label: row.label, value: row.value })),
      ],
      { keepTogether: true }
    ),
    pageBreak(),
    p(
      isCdc
        ? `I, ${issuedBy?.name || "—"}, certify that the development is complying development and (if carried out as specified in the certificate) will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation concerning the issue of the certificate.`
        : "I certify that building work completed in accordance with the documents accompanying the application for the certificate, including modifications verified by the certifier shown on the documents, will comply with the requirements referred to in the Act, Part 6.",
      { justify: true, spacingBefore: 150, keepNext: true }
    ),
    mixed([{ text: "Dated:  " }, { text: issuedDate }], { spacingBefore: 150 }),
    ...signatureBlock(images.signature),
    ...signatory(issuedBy?.name),
    p(
      isCdc
        ? "N.B. Prior to the commencement of work section 6.6 of the Environment Planning and Assessment Act 1979 must be satisfied."
        : "N.B Prior to the commencement of work Sections 4.19, 6.6, 6.7, 6.12, 6.13, 6.14 of the Environment Planning and Assessment Act 1979 must be satisfied.",
      { bold: true, spacingBefore: 180 }
    )
  );

  // 4. Schedule 1 to the certificate: the documents it relies on.
  //    Sits directly under the certificate it belongs to, rather than at
  //    the back of the pack behind the inspections notice.
  push(
    pageBreak(),
    ...documentTitle("SCHEDULE 1: APPROVED PLANS AND SPECIFICATIONS/ SUPPORTING DOCUMENTATION RELIED UPON"),
    gridTable(
      ["Prepared by", "Document", "Reference no.", "Revision", "Date"],
      allItems.map((i) => [i.prepared_by || "—", i.title, i.drawing_number || "—", i.revision || "—", formatDocumentDate(i.document_date)]),
      [24, 33, 15, 12, 16],
      { zebra: true, rowHeight: 230 }
    )
  );

  // 5. Mandatory inspections notice
  push(
    pageBreak(),
    ...documentTitle("NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS", {
      subtitle: "Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58",
    }),
    fieldTable([
      { kind: "heading", text: "APPLICANT DETAILS" },
      { kind: "row", label: "Name of the person having benefit of the Development Consent:", value: applicantName },
      { kind: "row", label: "Address:", value: formatAddress(d.applicantAddress) },
      { kind: "row", label: "Phone:", value: applicantPhone },
      ...(isCdc
        ? ([
            { kind: "heading", text: "COMPLYING DEVELOPMENT CONSENTS" },
            { kind: "row", label: "Consent Authority / Local Government Area:", value: d.council?.lga },
            { kind: "row", label: "Decision Made Under:", value: cd.relevantInstrument },
            { kind: "row", label: "CDC Number:", value: ref },
          ] as const)
        : ([
            { kind: "heading", text: "RELEVANT CONSENTS" },
            { kind: "row", label: "Consent Authority / Local Government Area:", value: d.council?.lga },
            { kind: "row", label: "Development Consent Number:", value: cd.developmentConsentNumber },
            { kind: "row", label: "Date Issued:", value: formatISODate(cd.developmentConsentDate) },
            { kind: "row", label: "Construction Certificate Number:", value: ref },
          ] as const)),
      { kind: "heading", text: "PROPOSAL" },
      { kind: "row", label: "Address of Development:", value: job.address },
      { kind: "row", label: "Scope of Building Works Covered by this Notice:", value: job.description },
      { kind: "heading", text: "CERTIFICATION DETAILS" },
      { kind: "row", label: "Certifying Authority:", value: issuedBy?.name },
      { kind: "row", label: "Registration Number:", value: issuedBy ? `${issuedBy.registration_body || ""} / ${issuedBy.registration_no || ""}` : null },
    ]),
    // From pathwayData, so this and the PDF cannot say different things.
    ...data.inspectionsNotice.map((paragraph, i) => p(paragraph, i === 0 ? { spacingBefore: 120 } : {})),
    p(
      "The applicant, being the person having benefit of the development consent, is required under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to notify the principal contractor (if not an owner-builder) of the applicable mandatory critical stage inspections specified under this notice."
    ),
    p(
      "To allow a principal certifier or another certifying authority time to carry out mandatory critical stage inspections, the principal contractor for the building site, or the owner builder, must notify the principal certifier at least 48 hours before building work is commenced at the site if a mandatory critical stage inspection is required before the commencement of the work in accordance with Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021."
    ),
    calloutBox([
      p(
        "Failure to request a mandatory critical stage inspection will prohibit the principal certifier under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to issue an occupation certificate.",
        { spacingAfter: 0 }
      ),
    ]),
    // The notice is dated the same way the on-screen copy and the PDF
    // approved set date it — this line was missing here, so the same
    // notice read differently depending on which button produced it.
    p(`Dated: ${issuedDate}`, { align: AlignmentType.RIGHT, spacingBefore: 120 }),
    ...signatureBlock(images.signature),
    ...signatory(issuedBy?.name, `Principal Certifier / ${issuedBy?.registration_no || "—"}`)
  );

  // 5b. Schedule 1 to the notice — on its own page, so it can be handed to the builder
  // as a standalone list of the inspections to book rather than being
  // buried at the foot of the notice.
  push(
    pageBreak(),
    ...documentTitle("SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS", { subtitle: `${pathwayFull} ${ref} — ${job.address || ""}` }),
    gridTable(
      ["No.", "Critical Stage Inspection", "Inspector"],
      selectedInspections.map((r, idx) => [`${idx + 1}.`, r.stage, r.inspector]),
      [8, 62, 30],
      { headerFill: INSPECTION_HEADER_FILL, centerColumns: [0], rowHeight: 340 }
    )
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
