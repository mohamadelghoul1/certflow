import { Document, Paragraph, Header, Footer, AlignmentType, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, bullet, pageBreak, splitRow, fieldTable, gridTable, calloutBox, image, signatureBlock, PAGE_PROPERTIES, FONT, TEXT_COLOR, MUTED_COLOR } from "@/lib/docx/shared";
import { formatAddress, formatAddressLines, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatISODate } from "@/lib/business";

// Mirrors app/certificate/pathway/[jobId]/page.tsx section-for-section, so
// any change to the real document content only needs to happen once in
// lib/certificates/pathwayData.ts — this file only handles how that same
// data is laid out as native Word paragraphs/tables instead of JSX.

function letterheadHeader(firm: PathwayCertificateData["firm"], logo: ImageAsset | null) {
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

function projectFooter(projRef: string, website: string | null | undefined) {
  return new Footer({ children: [splitRow(`Project No.: ${projRef}`, website || "", { size: 16, color: MUTED_COLOR })] });
}

export async function buildPathwayCertificateDocx(data: PathwayCertificateData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const { job, firm, issuedBy, conditions, allItems, selectedInspections, lapseDate, ref, projRef, isCdc, pathwayFull, d, cd, issuedDate, applicantName, applicantPhone, ownerName, ownerAddress, ownerPhone, councilBody, applicantBody, requiredDocsList } = data;

  const header = letterheadHeader(firm, images.logo);
  const footer = projectFooter(projRef, firm?.website);
  const children: FileChild[] = [];
  const push = (...items: FileChild[]) => children.push(...items);

  // 1. Council letter
  push(
    splitRow(`Our reference: ${projRef}`, issuedDate),
    p("The General Manager"),
    p(d.council?.lga || "Council"),
    ...formatAddressLines(d.council?.address).map((line) => p(line)),
    p("Dear Sir/Madam,"),
    mixed([{ text: "Re: ", bold: true }, { text: job.address || "" }]),
    mixed([{ text: `${pathwayFull} No.  `, bold: true }, { text: ref }]),
    isCdc
      ? mixed([{ text: "Planning Instrument Decision Made Under:  ", bold: true }, { text: cd.relevantInstrument || "—" }])
      : mixed([{ text: "Development Application No.:  ", bold: true }, { text: cd.developmentConsentNumber || "—" }]),
    ...councilBody.map((para) => p(para)),
    p("Please find enclosed the following documentation:"),
    bullet(`${pathwayFull} No. ${ref}`),
    bullet(`Copy of the application for the ${pathwayFull}.`),
    bullet(`Documentation used to determine the application for the ${pathwayFull} as detailed in Schedule 1 of the Certificate.`),
    p("Yours sincerely,", { spacingBefore: 240 }),
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 16, color: MUTED_COLOR }),
    p(`${firm?.name || ""} Pty Ltd`, { size: 16, color: MUTED_COLOR })
  );

  // 2. Applicant letter
  push(
    pageBreak(),
    splitRow(`Our reference: ${projRef}`, issuedDate),
    p(applicantName),
    ...formatAddressLines(d.applicantAddress).map((line) => p(line)),
    p("Dear Sir/Madam,"),
    mixed([{ text: "Re: ", bold: true }, { text: job.address || "" }]),
    mixed([{ text: `${pathwayFull} No.:  `, bold: true }, { text: ref }]),
    p(`Enclosed is a copy of the approved ${pathwayFull} for the subject development, and a copy of the stamped plans.`, { bold: true }),
    ...applicantBody.map((para) => p(para)),
    calloutBox([
      p("Please note that to accept the Notice of Appointment of Principal Certifier and Commencement of Building Work, you must provide:", { spacingAfter: 60 }),
      ...requiredDocsList.map((item) => bullet(item)),
    ]),
    p("Yours sincerely,", { spacingBefore: 240 }),
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 16, color: MUTED_COLOR }),
    p(`${firm?.name || ""} Pty Ltd`, { size: 16, color: MUTED_COLOR })
  );

  // 3. Certificate
  const certTitle = isCdc
    ? [p(`${pathwayFull} ${ref}`, { bold: true, uppercase: true, spacingAfter: 0 }), p(`PROJECT REFERENCE ${projRef}`, { bold: true, uppercase: true, spacingAfter: 60 })]
    : [p(`${pathwayFull} – ${projRef}`, { bold: true, uppercase: true, spacingAfter: 60 })];
  push(
    pageBreak(),
    ...certTitle,
    p(isCdc ? "Issued under Part 4, Division 4.5 of the Environmental Planning and Assessment Act 1979" : "Issued under Part 6 the Environmental Planning and Assessment Act 1979", { size: 16, color: MUTED_COLOR, spacingAfter: 120 }),
    p(
      isCdc
        ? "This CDC approval does not allow any work to commence. Principal Certifier must be appointed, and Home Building Compensation Fund (HBCF) has been issued by a licenced builder or Owner Builder Permit is issued by Building Commission NSW and all council fees/bonds have been paid."
        : "This Construction Certificate does not give authorisation of any construction works to commence until a Principal Certifier has been appointed.",
      { bold: true, spacingAfter: 200 }
    ),
    fieldTable([
      { kind: "heading", text: "APPLICANT DETAILS" },
      { kind: "row", label: "Applicant:", value: applicantName },
      { kind: "row", label: "Address:", value: formatAddress(d.applicantAddress) },
      { kind: "row", label: "Phone:", value: applicantPhone },
      { kind: "heading", text: "OWNER DETAILS" },
      { kind: "row", label: isCdc ? "Owner" : "Owner:", value: ownerName },
      { kind: "row", label: "Address:", value: ownerAddress },
      { kind: "row", label: "Phone:", value: ownerPhone },
      ...(isCdc
        ? ([
            { kind: "heading", text: `${pathwayFull.toUpperCase()} DETAILS` },
            { kind: "row", label: "NSW Planning Portal Ref Number:", value: cd.planningPortalRef },
            { kind: "row", label: "Local Government Area:", value: d.council?.lga },
            { kind: "row", label: "Relevant Environmental Planning Instrument", value: cd.relevantInstrument },
            { kind: "row", label: "Relevant Part of Code", value: cd.relevantPartOfCode },
            { kind: "row", label: "Date of Determination:", value: formatISODate(cd.determinationDate) },
            { kind: "row", label: "Date of Lapse:", value: /^\d{4}-\d{2}-\d{2}$/.test(lapseDate) ? formatISODate(lapseDate) : lapseDate },
          ] as const)
        : ([
            { kind: "heading", text: "RELEVANT DEVELOPMENT CONSENTS" },
            { kind: "row", label: "Consent Authority / Local Government Area:", value: d.council?.lga },
            { kind: "row", label: "Development Consent Number:", value: cd.developmentConsentNumber },
            { kind: "row", label: "Development Consent Date:", value: formatISODate(cd.developmentConsentDate) },
            { kind: "row", label: "NSW Planning Portal Ref Number:", value: cd.planningPortalRef },
            { kind: "row", label: "Construction Certificate Number:", value: ref },
            { kind: "row", label: "Date of Issue of Construction Certificate:", value: issuedDate },
          ] as const)),
      { kind: "heading", text: "PROPOSAL" },
      { kind: "row", label: "Address of Development:", value: job.address },
      { kind: "row", label: isCdc ? "Lot/Section/DP:" : "Lot/ DP:", value: cd.lotSectionDp },
      ...(isCdc ? ([{ kind: "row", label: "Land Use Zone:", value: d.zoning }] as const) : []),
      { kind: "row", label: isCdc ? "BCA Classification/s:" : "BCA Classification:", value: (d.proposal?.classifications || []).join(", ") },
      { kind: "row", label: "BCA/NCC Version:", value: d.bcaVersion },
      { kind: "row", label: "Description of Building Works:", value: job.description },
      { kind: "row", label: isCdc ? "Value of Construction (incl. GST):" : "Value of Construction Certificate (incl. GST)", value: formatCurrency(d.proposal?.estimatedCost) },
      { kind: "row", label: isCdc ? "Attachments" : "Attachments:", value: "Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon" },
      ...(isCdc
        ? ([
            {
              kind: "row",
              label: "Conditions:",
              children: [
                p("Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021", { spacingAfter: 60 }),
                p("Any monetary contribution fee’s and/or any other Council fee’s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.", { spacingAfter: conditions.length ? 60 : 0 }),
                ...conditions.map((c) => bullet(c.text)),
              ],
            },
          ] as const)
        : []),
      { kind: "row", label: isCdc ? "Critical stage inspections:" : "Critical Stage Inspections:", value: "See attached Notice" },
      // The certifying-authority declaration flows straight on as part of
      // the same certificate table rather than a separate "— continued"
      // page — a hard split here read as an abrupt cut rather than one
      // continuous certificate, so it's now one table that paginates
      // naturally if it runs long, the same way a real printed certificate
      // would.
      { kind: "heading", text: "REGISTERED CERTIFIER" },
      { kind: "row", label: "Registered Certifier:", value: issuedBy?.name },
      { kind: "row", label: "Registration Body:", value: issuedBy?.registration_body },
      { kind: "row", label: "Registration No:", value: issuedBy?.registration_no },
    ]),
    p(
      isCdc
        ? `I, ${issuedBy?.name || "—"}, certify that the development is complying development and (if carried out as specified in the certificate) will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation concerning the issue of the certificate.`
        : "I certify that building work completed in accordance with the documents accompanying the application for the certificate, including modifications verified by the certifier shown on the documents, will comply with the requirements referred to in the Act, Part 6.",
      { justify: true, spacingBefore: 200 }
    ),
    mixed([{ text: "Dated:  " }, { text: issuedDate }], { spacingBefore: 200 }),
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(
      isCdc
        ? "N.B. Prior to the commencement of work section 6.6 of the Environment Planning and Assessment Act 1979 must be satisfied."
        : "N.B Prior to the commencement of work Sections 4.19, 6.6, 6.7, 6.12, 6.13, 6.14 of the Environment Planning and Assessment Act 1979 must be satisfied.",
      { bold: true, spacingBefore: 240 }
    )
  );

  // 4. Mandatory inspections notice
  push(
    pageBreak(),
    p("NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS", { bold: true, size: 24, spacingAfter: 60 }),
    p("Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58", { size: 16, color: MUTED_COLOR, spacingAfter: 160 }),
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
    p(
      `I, ${issuedBy?.name || "—"} of ${firm?.name || ""} Pty Ltd, located at ${firm?.office_address || "—"}, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.`,
      { spacingBefore: 160 }
    ),
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
    ...signatureBlock(images.signature),
    p(issuedBy?.name || "—"),
    p(`Principal Certifier / ${issuedBy?.registration_no || "—"}`, { size: 16, color: MUTED_COLOR, spacingAfter: 200 }),
    p("SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS", { bold: true, spacingAfter: 100 }),
    gridTable(
      ["No.", "Critical Stage Inspection", "Inspector"],
      selectedInspections.map((r, idx) => [`${idx + 1}.`, r.stage, r.inspector]),
      [8, 62, 30]
    )
  );

  // 5. Checklist summary
  push(
    pageBreak(),
    p(`DOCUMENTS REQUESTED — ${job.pathway} CHECKLIST`, { bold: true, size: 24, spacingAfter: 40 }),
    p("Every document requested from the applicant during assessment, for reference.", { size: 16, color: MUTED_COLOR, spacingAfter: 160 }),
    gridTable(
      ["Document", "Status", "Document date"],
      allItems.map((i) => [i.title, i.status, formatISODate(i.document_date)]),
      [60, 20, 20]
    )
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
