import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

// The certifier's approval stamp, drawn onto every page of an approved
// document the way a wet stamp would be applied to a printed set.
//
// The four things the stamp has to carry are the firm it was issued by,
// the certificate it was issued under (the CDC or CC number), who signed
// it off, and their registration number — those are what makes a stamped
// plan traceable back to the approval it belongs to.

export type StampDetails = {
  firmName: string;
  certRef: string;
  pathway: string;
  certifierName: string;
  registrationNo: string;
  date: string;
  // An image of the firm's own stamp, used in place of the drawn box when
  // one has been uploaded. Text is still drawn underneath it, so the
  // certificate number and registration number are readable even if the
  // image doesn't include them.
  image?: { bytes: Uint8Array; type: "png" | "jpeg" } | null;
};

const MARGIN = 18;
const PADDING = 8;
const BORDER = rgb(0.1, 0.35, 0.32);
const TEXT = rgb(0.06, 0.2, 0.19);

function line(text: string, size: number, bold: boolean) {
  return { text, size, bold };
}

function stampLines(details: StampDetails) {
  return [
    line("APPROVED", 11, true),
    line(details.firmName || "—", 8, true),
    line(`${details.pathway} No: ${details.certRef}`, 8, false),
    line(details.certifierName || "—", 8, false),
    line(`Registration No: ${details.registrationNo || "—"}`, 8, false),
    line(`Date: ${details.date}`, 8, false),
  ];
}

function drawStamp(page: PDFPage, regular: PDFFont, bold: PDFFont, details: StampDetails) {
  const lines = stampLines(details);
  const widest = Math.max(...lines.map((l) => (l.bold ? bold : regular).widthOfTextAtSize(l.text, l.size)));
  const lineHeights = lines.map((l) => l.size + 3);
  const boxWidth = widest + PADDING * 2;
  const boxHeight = lineHeights.reduce((a, b) => a + b, 0) + PADDING * 2;

  const { width } = page.getSize();
  // Bottom-right, the corner a title block leaves clear on almost every
  // architectural sheet. Clamped so it stays on the page even on a sheet
  // narrower than the stamp itself.
  const x = Math.max(MARGIN, width - boxWidth - MARGIN);
  const y = MARGIN;

  page.drawRectangle({ x, y, width: boxWidth, height: boxHeight, borderColor: BORDER, borderWidth: 1.2, color: rgb(1, 1, 1), opacity: 0.92 });

  let cursor = y + boxHeight - PADDING;
  lines.forEach((l, i) => {
    cursor -= lineHeights[i];
    page.drawText(l.text, { x: x + PADDING, y: cursor, size: l.size, font: l.bold ? bold : regular, color: TEXT });
  });
}

// Draws the firm's uploaded stamp image above the text block, scaled to
// the stamp's width so a tall or wide image both sit sensibly.
async function drawStampImage(pdf: PDFDocument, page: PDFPage, details: StampDetails) {
  if (!details.image) return;
  const embedded = details.image.type === "png" ? await pdf.embedPng(details.image.bytes) : await pdf.embedJpg(details.image.bytes);
  const targetWidth = 120;
  const scale = targetWidth / embedded.width;
  const height = embedded.height * scale;
  const { width } = page.getSize();
  const x = Math.max(MARGIN, width - targetWidth - MARGIN);
  page.drawImage(embedded, { x, y: MARGIN + 96, width: targetWidth, height, opacity: 0.95 });
}

// Stamps every page of a PDF. Returns null rather than throwing if the
// bytes aren't a PDF we can open — a document uploaded as something else
// simply goes into the bundle unstamped, which is better than failing the
// whole download.
export async function stampPdf(bytes: Uint8Array, details: StampDetails): Promise<Uint8Array | null> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      drawStamp(page, regular, bold, details);
      await drawStampImage(pdf, page, details);
    }
    return await pdf.save();
  } catch {
    return null;
  }
}

// A standalone one-page PDF of the stamp on its own, for a certifier who
// wants to print it, or drop it into their own PDF tool by hand.
export async function stampSheetPdf(details: StampDetails): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 200]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  drawStamp(page, regular, bold, details);
  await drawStampImage(pdf, page, details);
  return pdf.save();
}

// Loads the firm's uploaded stamp artwork for use with stampPdf. Anything
// that isn't a readable PNG or JPEG comes back as null, which leaves the
// drawn stamp on its own.
export async function fetchStampImage(url: string | null): Promise<StampDetails["image"]> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, type: "png" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: "jpeg" };
    return null;
  } catch {
    return null;
  }
}
