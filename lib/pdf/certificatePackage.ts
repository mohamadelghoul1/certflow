import { Layout, MARGIN, A4, MUTED, HEADRULE } from "@/lib/pdf/layout";
import { formatAddress, formatAddressLines, formatBcaVersion, formatCurrency, type PathwayCertificateData } from "@/lib/certificates/pathwayData";
import { formatISODate, letterheadAddressLines } from "@/lib/business";

// The CDC/CC certificate package as a PDF, mirroring
// lib/docx/pathwayCertificate.ts section for section: council letter,
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
    const top = A4[1] - MARGIN;
    let leftBottom = top;

    if (logo) {
      const height = 34;
      const width = logo.width * (height / logo.height);
      layout.page.drawImage(logo, { x: MARGIN, y: top - height, width, height });
      leftBottom = top - height;
    } else {
      layout.page.drawText(firm?.name || "", { x: MARGIN, y: top - 11, size: 11, font: layout.bold, color: HEADRULE });
      leftBottom = top - 14;
    }
    layout.page.drawText(`ABN: ${firm?.abn || "—"}`, { x: MARGIN, y: leftBottom - 10, size: 7, font: layout.regular, color: MUTED });

    const right: string[] = [];
    letterheadAddressLines(firm?.postal_address).forEach((line, i) => right.push(i === 0 ? `Postal: ${line}` : line));
    letterheadAddressLines(firm?.office_address).forEach((line, i) => right.push(i === 0 ? `Office: ${line}` : line));
    right.push(`(p): ${firm?.phone || "—"}`, `(e): ${firm?.email || "—"}`);
    right.forEach((line, i) => {
      const w = layout.regular.widthOfTextAtSize(line, 7);
      layout.page.drawText(line, { x: A4[0] - MARGIN - w, y: top - 8 - i * 9, size: 7, font: layout.regular, color: MUTED });
    });

    const ruleY = Math.min(leftBottom - 18, top - 8 - right.length * 9 - 6);
    layout.page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: A4[0] - MARGIN, y: ruleY }, thickness: 1.2, color: HEADRULE });
    layout.y = ruleY - 16;
  };

  l.footer = (layout) => {
    const y = MARGIN - 12;
    layout.page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: A4[0] - MARGIN, y: y + 10 }, thickness: 0.5, color: MUTED });
    layout.page.drawText(`Project No.: ${projRef}`, { x: MARGIN, y, size: 7, font: layout.regular, color: MUTED });
    const site = firm?.website || "";
    const w = layout.regular.widthOfTextAtSize(site, 7);
    layout.page.drawText(site, { x: A4[0] - MARGIN - w, y, size: 7, font: layout.regular, color: MUTED });
  };

  const splitLine = (left: string, right: string) => {
    l.ensure(14);
    l.y -= 12;
    l.page.drawText(left, { x: MARGIN, y: l.y, size: 9, font: l.regular, color: HEADRULE });
    const w = l.regular.widthOfTextAtSize(right, 9);
    l.page.drawText(right, { x: A4[0] - MARGIN - w, y: l.y, size: 9, font: l.regular, color: HEADRULE });
    l.y -= 6;
  };

  const signature = async () => {
    if (images.signature) await l.image(images.signature.bytes, images.signature.type, 42);
    else l.gap(34);
  };

  // 1. Council letter
  l.newPage();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.text("The General Manager");
  l.text(d.council?.lga || "Council");
  formatAddressLines(d.council?.address).forEach((line) => l.text(line, { gapAfter: 2 }));
  l.gap(4);
  l.text("Dear Sir/Madam,");
  l.text(`Re: ${job.address || ""}`, { bold: true });
  councilBody.forEach((line) => l.text(line, { gapAfter: 7 }));
  l.gap(6);
  l.text("Yours faithfully,");
  await signature();
  l.text(issuedBy?.name || "—", { gapAfter: 1 });
  l.text(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 7.5, color: MUTED });

  // 2. Applicant letter
  l.pageBreak();
  splitLine(`Our reference: ${projRef}`, issuedDate);
  l.text(applicantName || "");
  formatAddressLines(d.applicantAddress).forEach((line) => l.text(line, { gapAfter: 2 }));
  l.gap(4);
  l.text("Dear Sir/Madam,");
  l.text(`Re: ${job.address || ""}`, { bold: true });
  applicantBody.forEach((line) => l.text(line, { gapAfter: 7 }));
  if (requiredDocsList.length) {
    l.gap(2);
    requiredDocsList.forEach((line) => l.bullet(line));
    l.gap(4);
  }
  l.text("Yours faithfully,");
  await signature();
  l.text(issuedBy?.name || "—", { gapAfter: 1 });
  l.text(`Registered Certifier / ${issuedBy?.registration_no || "—"}`, { size: 7.5, color: MUTED });

  // 3. The certificate itself
  l.pageBreak();
  l.text(pathwayFull.toUpperCase(), { size: 13, bold: true, gapAfter: 2 });
  l.text(`${isCdc ? "Complying Development Certificate" : "Construction Certificate"} No: ${ref}`, { size: 9, color: MUTED, gapAfter: 10 });

  l.heading("APPLICANT DETAILS", { rule: true });
  l.fieldRow("Applicant:", applicantName || "");
  l.fieldRow("Address:", formatAddress(d.applicantAddress) || "");
  l.fieldRow("Phone:", applicantPhone || "");
  l.fieldRow("Owner:", ownerName || "");
  l.fieldRow("Owner address:", ownerAddress || "");
  l.fieldRow("Owner phone:", ownerPhone || "");

  l.heading(isCdc ? "COMPLYING DEVELOPMENT" : "RELEVANT DEVELOPMENT CONSENTS", { rule: true });
  l.fieldRow("Consent Authority / Local Government Area:", d.council?.lga || "");
  if (isCdc) {
    l.fieldRow("Decision Made Under:", cd.relevantInstrument || "");
    l.fieldRow("Relevant Part of Code:", cd.relevantPartOfCode || "");
    l.fieldRow("NSW Planning Portal Ref Number:", cd.planningPortalRef || "");
    l.fieldRow("CDC Number:", ref);
    l.fieldRow("Date of Determination:", formatISODate(cd.determinationDate));
    l.fieldRow("This certificate lapses on:", lapseDate);
  } else {
    l.fieldRow("Development Consent Number:", cd.developmentConsentNumber || "");
    l.fieldRow("Development Consent Date:", formatISODate(cd.developmentConsentDate));
    l.fieldRow("NSW Planning Portal Ref Number:", cd.planningPortalRef || "");
    l.fieldRow("Construction Certificate Number:", ref);
    l.fieldRow("Date of Issue:", issuedDate);
  }

  l.heading("PROPOSAL", { rule: true });
  l.fieldRow("Address of Development:", job.address || "");
  l.fieldRow(isCdc ? "Lot/Section/DP:" : "Lot/ DP:", cd.lotSectionDp || "");
  if (isCdc) l.fieldRow("Land Use Zone:", d.zoning || "");
  l.fieldRow(isCdc ? "BCA Classification/s:" : "BCA Classification:", (d.proposal?.classifications || []).join(", "));
  l.fieldRow("BCA/NCC Version:", formatBcaVersion(d.bcaVersion, d.bcaVolumes));
  l.fieldRow("Description of Building Works:", job.description || "");
  l.fieldRow(isCdc ? "Value of Construction (incl. GST):" : "Value of Construction Certificate (incl. GST)", formatCurrency(d.proposal?.estimatedCost) || "");
  l.fieldRow("Attachments:", "Schedule 1: Approved Plans and Specifications and Supporting Documentation Relied Upon");

  if (isCdc) {
    l.heading("CONDITIONS", { rule: true });
    l.text(
      "Conditions under the Environmental Planning and Assessment Regulation 2021 and State Environmental Planning Policy (Exempt and Complying Development) Codes 2008 & State Environmental Planning Policy (Housing) 2021",
      { gapAfter: 4 }
    );
    l.text(
      "Any monetary contribution fee’s and/or any other Council fee’s/bonds that are required by council MUST be paid prior to commencement of building works. A receipt is to be sent to the PC. Any works in council property MUST have prior approval from Council and a copy of such approval provided to the PC prior to the works commencing.",
      { gapAfter: 4 }
    );
    conditions.forEach((c) => l.bullet(c.text));
  }
  l.fieldRow(isCdc ? "Critical stage inspections:" : "Critical Stage Inspections:", "See attached Notice");

  // Kept together with the declaration and signature below it.
  l.ensure(190);
  l.heading("REGISTERED CERTIFIER", { rule: true });
  l.fieldRow("Registered Certifier:", issuedBy?.name || "");
  l.fieldRow("Registration Body:", issuedBy?.registration_body || "");
  l.fieldRow("Registration No:", issuedBy?.registration_no || "");
  l.gap(6);
  l.text(
    isCdc
      ? `I, ${issuedBy?.name || "—"}, certify that the development is complying development and (if carried out as specified in the certificate) will comply with all development standards applicable to the development and with such other requirements prescribed by this regulation concerning the issue of the certificate.`
      : "I certify that building work completed in accordance with the documents accompanying the application for the certificate, including modifications verified by the certifier shown on the documents, will comply with the requirements referred to in the Act, Part 6."
  );
  l.gap(4);
  l.text(`Dated:  ${issuedDate}`);
  await signature();
  l.text(issuedBy?.name || "—");
  l.gap(4);
  l.text(
    isCdc
      ? "N.B. Prior to the commencement of work section 6.6 of the Environment Planning and Assessment Act 1979 must be satisfied."
      : "N.B Prior to the commencement of work Sections 4.19, 6.6, 6.7, 6.12, 6.13, 6.14 of the Environment Planning and Assessment Act 1979 must be satisfied.",
    { bold: true }
  );

  // 4. Mandatory inspections notice
  l.pageBreak();
  l.text("NOTICE TO APPLICANT OF MANDATORY CRITICAL STAGE INSPECTIONS", { size: 12, bold: true, gapAfter: 2 });
  l.text("Made under Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 — Section 58", { size: 8, color: MUTED, gapAfter: 10 });

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
    `I, ${issuedBy?.name || "—"} of ${firm?.name || ""} Pty Ltd, located at ${firm?.office_address || "—"}, acting as the principal certifier, hereby give notice in accordance with Section 58 of the Part 7 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to the person having the benefit of the development consent that the mandatory critical stage inspections identified in Schedule 1 are to be carried out in respect of the building work.`
  );
  l.text(
    "The applicant, being the person having benefit of the development consent, is required under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to notify the principal contractor (if not an owner-builder) of the applicable mandatory critical stage inspections specified under this notice."
  );
  l.text(
    "To allow a principal certifier or another certifying authority time to carry out mandatory critical stage inspections, the principal contractor for the building site, or the owner builder, must notify the principal certifier at least 48 hours before building work is commenced at the site if a mandatory critical stage inspection is required before the commencement of the work in accordance with Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021."
  );
  l.text(
    "Failure to request a mandatory critical stage inspection will prohibit the principal certifier under Section 58 of the Environmental Planning and Assessment (Development Certification and Fire Safety) Regulation 2021 to issue an occupation certificate.",
    { bold: true }
  );
  l.gap(2);
  l.text(`Dated: ${issuedDate}`, { align: "right" });
  await signature();
  l.text(issuedBy?.name || "—", { gapAfter: 1 });
  l.text(`Principal Certifier / ${issuedBy?.registration_no || "—"}`, { size: 7.5, color: MUTED });

  // 4b. Schedule 1, on its own page
  l.pageBreak();
  l.text("SCHEDULE 1: MANDATORY CRITICAL STAGE INSPECTIONS", { size: 12, bold: true, gapAfter: 2 });
  l.text(`${pathwayFull} ${ref} — ${job.address || ""}`, { size: 8, color: MUTED, gapAfter: 10 });
  l.table(
    ["No.", "Critical Stage Inspection", "Inspector"],
    selectedInspections.map((r, i) => [`${i + 1}.`, r.stage, r.inspector]),
    [8, 62, 30]
  );

  // 5. Documents requested
  l.pageBreak();
  l.text(`DOCUMENTS REQUESTED — ${job.pathway} CHECKLIST`, { size: 12, bold: true, gapAfter: 2 });
  l.text("Every document requested from the applicant during assessment, for reference.", { size: 8, color: MUTED, gapAfter: 10 });
  l.table(
    ["Prepared by", "Document", "Reference no.", "Revision", "Date", "Status"],
    allItems.map((i) => [i.prepared_by || "—", i.title, i.drawing_number || "—", i.revision || "—", formatISODate(i.document_date), i.status]),
    [18, 30, 16, 11, 13, 12]
  );

  return l.save();
}
