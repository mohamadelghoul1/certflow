import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// The agreement with the signatures merged into it.
//
// The firm's own contract is the document — CertFlow does not rewrite
// it, it draws each signature into the execution block the certifier
// pointed at and appends the record of who signed and when. What comes
// out is one file: the contract as executed.

export type MergeSignatory = {
  name: string;
  role: string | null;
  email: string;
  signedName: string | null;
  signedAt: string | null;
  signatureImage: string | null;
  signedIp: string | null;
};

export type SignaturePlacement = { page: number; x: number; y: number; width: number } | null;

const INK = rgb(0.05, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);

function sydney(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "long", timeStyle: "short" });
}

function decodeSignature(dataUrl: string): { bytes: Uint8Array; png: boolean } | null {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  return { bytes: Buffer.from(match[2], "base64"), png: match[1] === "png" };
}

export async function buildSignedAgreement(original: Uint8Array, signatories: MergeSignatory[], placement: SignaturePlacement): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const signed = signatories.filter((s) => s.signedAt);

  // Onto the contract's own execution block, where the certifier put it.
  // Each signature sits under the one before, so joint owners fill the
  // block down the page the way they would have signed it by hand.
  if (placement && signed.length > 0) {
    const pages = doc.getPages();
    const page = pages[Math.min(Math.max(placement.page, 1), pages.length) - 1];
    const { width: pw, height: ph } = page.getSize();
    const boxWidth = Math.max(60, placement.width * pw);
    // Enough room for the mark and the line of detail under it.
    const rowHeight = boxWidth * 0.28 + 16;
    let top = ph - placement.y * ph;

    for (const party of signed) {
      const image = party.signatureImage ? decodeSignature(party.signatureImage) : null;
      if (image) {
        const embedded = image.png ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
        const scale = boxWidth / embedded.width;
        const drawnHeight = Math.min(embedded.height * scale, rowHeight - 14);
        page.drawImage(embedded, {
          x: placement.x * pw,
          y: top - drawnHeight,
          width: (drawnHeight / embedded.height) * embedded.width,
          height: drawnHeight,
        });
        top -= drawnHeight + 2;
      }
      const caption = `${party.signedName || party.name}${party.signedAt ? ` — ${sydney(party.signedAt)}` : ""}`;
      page.drawText(caption, { x: placement.x * pw, y: top - 8, size: 7, font: regular, color: MUTED });
      top -= 22;
    }
  }

  // The record, always appended: who signed, as what, when, and from
  // where. This is what an auditor reads, and it travels with the
  // contract rather than living in a separate file that gets separated.
  const record = doc.addPage();
  const { width, height } = record.getSize();
  const margin = 56;
  let y = height - margin;

  record.drawText("Certificate of electronic signing", { x: margin, y, size: 16, font: bold, color: INK });
  y -= 26;
  record.drawText("This page records the electronic execution of the agreement it is attached to.", {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: MUTED,
  });
  y -= 28;

  for (const party of signatories) {
    if (y < margin + 120) {
      y = height - margin;
      doc.addPage();
    }
    record.drawText(`${party.name}${party.role ? ` — ${party.role}` : ""}`, { x: margin, y, size: 11, font: bold, color: INK });
    y -= 14;
    record.drawText(party.email, { x: margin, y, size: 9, font: regular, color: MUTED });
    y -= 16;

    if (party.signedAt) {
      const image = party.signatureImage ? decodeSignature(party.signatureImage) : null;
      if (image) {
        const embedded = image.png ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
        const drawWidth = Math.min(180, embedded.width);
        const drawHeight = (drawWidth / embedded.width) * embedded.height;
        record.drawImage(embedded, { x: margin, y: y - drawHeight, width: drawWidth, height: drawHeight });
        y -= drawHeight + 4;
      }
      record.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 0.5, color: MUTED });
      y -= 12;
      record.drawText(`Signed as ${party.signedName || party.name}`, { x: margin, y, size: 9, font: regular, color: INK });
      y -= 12;
      record.drawText(sydney(party.signedAt) + " (Sydney)", { x: margin, y, size: 9, font: regular, color: MUTED });
      y -= 12;
      if (party.signedIp) {
        record.drawText(`Recorded from ${party.signedIp}`, { x: margin, y, size: 8, font: regular, color: MUTED });
        y -= 12;
      }
      record.drawText("Declared they had read the agreement, were authorised to sign, and agreed to be bound by it.", {
        x: margin,
        y,
        size: 8,
        font: regular,
        color: MUTED,
      });
      y -= 26;
    } else {
      record.drawText("Not signed.", { x: margin, y, size: 9, font: regular, color: MUTED });
      y -= 26;
    }
  }

  record.drawText("Signatures captured by CertFlow. Each signatory received a private link by email and signed in their own name.", {
    x: margin,
    y: margin - 12,
    size: 7,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}
