import { Document, Packer } from "docx";
import type { FileChild } from "docx";
import type { ImageAsset } from "@/lib/docx/shared";
import { p, mixed, bullet, splitRow, documentTitle, signatureBlock, signatory, PAGE_PROPERTIES, FONT, TEXT_COLOR, BODY_SIZE, LETTER_BODY_SIZE, LETTER_PARA_AFTER, LETTER_LINE_SPACING, LETTER_SIGNATURE_NAME_SIZE } from "@/lib/docx/shared";
import { letterheadHeader, projectFooter } from "@/lib/docx/pathwayCertificate";
import type { Firm, Certifier } from "@/types/db";

// The neighbour notification letter — the notice under s134 of the
// Environmental Planning and Assessment Regulation 2021 that a CDC
// application has been received, with the applicant's details so
// neighbours can discuss the proposal during the 14 days before
// determination.
//
// The wording follows the firm's own template (Neighbouring Notification —
// Quality Private Certifiers) line for line; only the job's details are
// merged in: the site address, the proposed development, the applicant's
// contact details, and the certifier signing it. Addressed "Dear Occupant"
// with no recipient block, exactly as the template is — one letter,
// printed as many times as there are letterboxes. A Word file so it stays
// editable before sending, like every letter CertFlow generates.

export type NeighbourLetterData = {
  firm: Firm | null;
  certifier: Certifier | null;
  jobAddress: string;
  description: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  applicantAddress: string;
  projRef: string; // the project number, for the page footer
  issuedDate: string; // today, formatted — the date on the letter
};

const letterOpts = { size: LETTER_BODY_SIZE, justify: true, spacingAfter: LETTER_PARA_AFTER, lineSpacing: LETTER_LINE_SPACING } as const;

export async function buildNeighbourLetterDocx(data: NeighbourLetterData, images: { logo: ImageAsset | null; signature: ImageAsset | null }): Promise<Buffer> {
  const { firm, certifier, jobAddress, description, applicantName, applicantPhone, applicantEmail, applicantAddress, projRef, issuedDate } = data;

  const header = letterheadHeader(firm, images.logo);
  const footer = projectFooter(projRef, firm?.website);

  const children: FileChild[] = [
    ...documentTitle("Notification of Application for a Complying Development Certificate", {
      subtitle: "Environmental Planning & Assessment Regulation 2021 Section 134",
    }),
    splitRow("", issuedDate, { size: LETTER_BODY_SIZE }),
    p("Dear Occupant,", { size: LETTER_BODY_SIZE, spacingAfter: 60 }),
    p(
      `${firm?.name || "This firm"} received an application for a complying development certificate (CDC) that relates to a property close to your address at ${jobAddress}.`,
      letterOpts
    ),
    mixed([{ text: "The proposed development is for " }, { text: description || "—", bold: true }, { text: "." }], letterOpts),
    p("Below is the Applicant Details if you wish to discuss the proposal:", { size: LETTER_BODY_SIZE, spacingAfter: 40 }),
    mixed([{ text: "Full name: ", bold: true }, { text: applicantName || "—" }], { size: LETTER_BODY_SIZE, spacingAfter: 0 }),
    mixed([{ text: "Phone: ", bold: true }, { text: applicantPhone || "—" }], { size: LETTER_BODY_SIZE, spacingAfter: 0 }),
    mixed([{ text: "Email: ", bold: true }, { text: applicantEmail || "—" }], { size: LETTER_BODY_SIZE, spacingAfter: 0 }),
    mixed([{ text: "Address: ", bold: true }, { text: applicantAddress || "—" }], { size: LETTER_BODY_SIZE, spacingAfter: LETTER_PARA_AFTER }),
    p("What is a complying development certificate?", { bold: true, size: LETTER_BODY_SIZE, spacingBefore: 80, spacingAfter: 40 }),
    p(
      "A CDC is a type of development approval that may only be issued if the proposal is ‘complying development’; that is, it meets specific, pre-determined development standards in:",
      letterOpts
    ),
    bullet("The local Council LEP, and", { size: LETTER_BODY_SIZE }),
    bullet("State Environmental Planning Policy (Exempt and Complying Development Codes) 2008, Part 3 Housing Code, and", { size: LETTER_BODY_SIZE }),
    bullet("The Environmental Planning and Assessment Regulation 2021, and", { size: LETTER_BODY_SIZE }),
    bullet("The Building Code of Australia.", { size: LETTER_BODY_SIZE }),
    p("What happens next?", { bold: true, size: LETTER_BODY_SIZE, spacingBefore: 120, spacingAfter: 40 }),
    p(
      "The application for the CDC will be determined no sooner than 14 days from the date of this notice. This 14-day period is your opportunity to contact the applicant if you wish to discuss the proposed development.",
      letterOpts
    ),
    p(
      "This notice is for information only and aims to encourage neighbours to discuss the development before the proposal is determined.",
      letterOpts
    ),
    p("The application will be determined in accordance with the Environmental Planning and Assessment Act 1979.", letterOpts),
    p(
      "Once the application is determined, the council is required to make a copy of the determination available for inspection at its office free of charge.",
      letterOpts
    ),
    ...signatureBlock(images.signature),
    ...signatory({ size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE }, certifier?.name, "Registered Certifier", `${firm?.name || ""} Pty Ltd`),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: TEXT_COLOR } } } },
    sections: [{ properties: PAGE_PROPERTIES, headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
