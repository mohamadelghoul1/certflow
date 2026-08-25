import { Layout, LETTER_BODY_SIZE, LETTER_PARA_AFTER, LETTER_SIGNATURE_NAME_SIZE, A4, MARGIN, INK } from "@/lib/pdf/layout";
import { letterheadHeader, projectFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { SEPP_CODES_2008_NAME } from "@/lib/constants";
import type { NeighbourLetterData } from "@/lib/certificates/neighbourLetterData";

// The s134 neighbour notification as a PDF, mirroring
// lib/docx/neighbourLetters.ts line for line.
//
// The Word file is for editing before it goes out; this one is for
// printing a copy per letterbox without opening Word at all. Same
// letterhead and footer as everything else the job generates.

// The middle bullet of the "what is a CDC" list: the instrument this job
// is assessed under, with the part of it relied on where one is recorded.
// Falls back to the Codes SEPP — the instrument behind most complying
// development — when the job hasn't recorded one yet, so the letter is
// never left with a gap in the middle of a legislative list.
function instrumentBullet(instrument: string, part: string) {
  const name = instrument.trim() || SEPP_CODES_2008_NAME;
  return part.trim() ? `${name}, ${part.trim()}, and` : `${name}, and`;
}

export async function buildNeighbourLetterPdf(data: NeighbourLetterData, images: PackageImages): Promise<Uint8Array> {
  const { firm, certifier, jobAddress, description, applicantName, applicantPhone, applicantEmail, applicantAddress, relevantInstrument, relevantPartOfCode, projRef, issuedDate } = data;

  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.header = letterheadHeader(firm, logo);
  l.footer = projectFooter(projRef, firm?.website);

  const body = (text: string) => l.text(text, { size: LETTER_BODY_SIZE, justify: true, letter: true, gapAfter: LETTER_PARA_AFTER });
  const detail = (label: string, value: string) =>
    l.inline([{ text: `${label} `, bold: true }, { text: value || "—" }], { size: LETTER_BODY_SIZE, gapAfter: 1 });

  l.newPage();
  l.documentTitle("NOTIFICATION OF APPLICATION FOR A COMPLYING DEVELOPMENT CERTIFICATE", {
    subtitle: "Environmental Planning & Assessment Regulation 2021 Section 134",
  });

  // The date sits alone on the right, as it does on the template — there
  // is no recipient block to balance it against.
  const dateWidth = l.regular.widthOfTextAtSize(issuedDate, LETTER_BODY_SIZE);
  l.ensure(16);
  l.y -= 12;
  l.page.drawText(issuedDate, { x: A4[0] - MARGIN - dateWidth, y: l.y, size: LETTER_BODY_SIZE, font: l.regular, color: INK });
  l.y -= 10;

  l.text("Dear Occupant,", { size: LETTER_BODY_SIZE, gapAfter: LETTER_PARA_AFTER, letter: true });
  body(`${firm?.name || "This firm"} received an application for a complying development certificate (CDC) that relates to a property close to your address at ${jobAddress}.`);
  l.inline([{ text: "The proposed development is for " }, { text: description || "—", bold: true }, { text: "." }], { size: LETTER_BODY_SIZE, gapAfter: LETTER_PARA_AFTER });
  l.text("Below is the Applicant Details if you wish to discuss the proposal:", { size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  detail("Full name:", applicantName);
  detail("Phone:", applicantPhone);
  detail("Email:", applicantEmail);
  detail("Address:", applicantAddress);

  l.gap(6);
  l.text("What is a complying development certificate?", { bold: true, size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  body("A CDC is a type of development approval that may only be issued if the proposal is ‘complying development’; that is, it meets specific, pre-determined development standards in:");
  l.bullet("The local Council LEP, and", { size: LETTER_BODY_SIZE });
  l.bullet(instrumentBullet(relevantInstrument, relevantPartOfCode), { size: LETTER_BODY_SIZE });
  l.bullet("The Environmental Planning and Assessment Regulation 2021, and", { size: LETTER_BODY_SIZE });
  l.bullet("The Building Code of Australia.", { size: LETTER_BODY_SIZE });

  l.gap(8);
  l.text("What happens next?", { bold: true, size: LETTER_BODY_SIZE, gapAfter: 3, letter: true });
  body("The application for the CDC will be determined no sooner than 14 days from the date of this notice. This 14-day period is your opportunity to contact the applicant if you wish to discuss the proposed development.");
  body("This notice is for information only and aims to encourage neighbours to discuss the development before the proposal is determined.");
  body("The application will be determined in accordance with the Environmental Planning and Assessment Act 1979.");
  body("Once the application is determined, the council is required to make a copy of the determination available for inspection at its office free of charge.");

  // The signature and the name beneath it move together, so the letter
  // never ends with a signature stranded on a page of its own.
  l.ensure(78);
  if (images.signature) await l.image(images.signature.bytes, images.signature.type, 42);
  else l.gap(34);
  l.signatory(certifier?.name || "—", ["Registered Certifier", `${firm?.name || ""} Pty Ltd`], { size: LETTER_BODY_SIZE, nameSize: LETTER_SIGNATURE_NAME_SIZE });

  return l.save();
}
