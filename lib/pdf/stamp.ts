import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

// The certifier's approval stamp, drawn onto every page of an approved
// document the way a wet stamp would be applied to a printed set.
//
// The four things the stamp has to carry are the firm it was issued by,
// the certificate it was issued under (the CDC or CC number), who signed
// it off, and their registration number — those are what makes a stamped
// plan traceable back to the approval it belongs to.
//
// Where it sits is the certifier's call: a title block lands in a
// different corner on every consultant's sheet, so the stamp can be
// dragged anywhere on the page and resized. Position is stored as a
// fraction of the page rather than in points, so one placement holds
// whether the sheet is A4 or A0, portrait or landscape.

export type StampDetails = {
  firmName: string;
  certRef: string;
  pathway: string;
  certifierName: string;
  registrationNo: string;
  date: string;
  // An image of the firm's own stamp, used above the drawn box when one
  // has been uploaded. Text is still drawn underneath it, so the
  // certificate number and registration number are readable even if the
  // image doesn't include them.
  image?: { bytes: Uint8Array; type: "png" | "jpeg" } | null;
};

// x and y are the stamp's top-left corner as a fraction of the page,
// measured from the page's top-left — the way it reads on screen. scale
// is a multiplier on the stamp's natural size.
export type StampPlacement = { x: number; y: number; scale: number };

export const DEFAULT_STAMP_SCALE = 1;

const MARGIN = 18;
const PADDING = 8;
const BORDER = rgb(0.1, 0.35, 0.32);
const TEXT = rgb(0.06, 0.2, 0.19);
const IMAGE_WIDTH = 120;
const IMAGE_GAP = 6;
const LEADING = 3;
const BORDER_WIDTH = 1.2;

// The colours the on-screen preview has to match, as CSS.
export const STAMP_BORDER_CSS = "#1a594f";
export const STAMP_TEXT_CSS = "#0f3330";

export type StampLine = { text: string; size: number; bold: boolean };

export function stampLines(details: StampDetails): StampLine[] {
  return [
    { text: "APPROVED", size: 11, bold: true },
    { text: details.firmName || "—", size: 8, bold: true },
    { text: `${details.pathway} No: ${details.certRef}`, size: 8, bold: false },
    { text: details.certifierName || "—", size: 8, bold: false },
    { text: `Registration No: ${details.registrationNo || "—"}`, size: 8, bold: false },
    { text: `Date: ${details.date}`, size: 8, bold: false },
  ];
}

// The stamp's geometry in PDF points at its natural size. Everything —
// padding, leading, border, the artwork — scales by the same factor, so
// the whole stamp is a uniform scale of this one shape. That is what lets
// the on-screen positioner draw exactly what will be printed: it is handed
// these numbers and multiplies.
export const STAMP_IMAGE_WIDTH = IMAGE_WIDTH;
export const STAMP_IMAGE_GAP = IMAGE_GAP;
export const STAMP_PADDING = PADDING;

export type StampGeometry = {
  width: number;
  height: number;
  textWidth: number;
  textHeight: number;
  imageWidth: number;
  imageHeight: number;
  gap: number;
};

export function stampGeometry(lines: StampLine[], regular: PDFFont, bold: PDFFont, imageAspect: number | null): StampGeometry {
  const widest = Math.max(...lines.map((l) => (l.bold ? bold : regular).widthOfTextAtSize(l.text, l.size)));
  const textWidth = widest + PADDING * 2;
  const textHeight = lines.reduce((total, l) => total + l.size + LEADING, 0) + PADDING * 2;
  // imageAspect is height/width, so the artwork keeps its proportions
  // whether it was uploaded tall or wide.
  const imageWidth = imageAspect ? IMAGE_WIDTH : 0;
  const imageHeight = imageAspect ? IMAGE_WIDTH * imageAspect : 0;
  const gap = imageAspect ? IMAGE_GAP : 0;
  return { width: Math.max(textWidth, imageWidth), height: textHeight + gap + imageHeight, textWidth, textHeight, imageWidth, imageHeight, gap };
}

// The text half's size, measured without needing the artwork — what the
// job screen hands the positioner. The positioner works the artwork out
// for itself from the image it loads.
export async function measureStampText(details: StampDetails): Promise<{ textWidth: number; textHeight: number }> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { textWidth, textHeight } = stampGeometry(stampLines(details), regular, bold, null);
  return { textWidth, textHeight };
}

// Turns a placement into the bottom-left origin pdf-lib draws from,
// clamped so the stamp always lands on the sheet however it was dragged
// or however small the sheet is. With no placement it falls back to the
// bottom-right corner, which is where it sat before this was adjustable.
export function stampOrigin(pageWidth: number, pageHeight: number, width: number, height: number, placement: StampPlacement | null) {
  if (!placement) {
    return { x: Math.max(MARGIN, pageWidth - width - MARGIN), y: MARGIN };
  }
  const x = placement.x * pageWidth;
  const yFromTop = placement.y * pageHeight;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, pageWidth - width)),
    y: Math.min(Math.max(0, pageHeight - yFromTop - height), Math.max(0, pageHeight - height)),
  };
}

async function drawStamp(pdf: PDFDocument, page: PDFPage, regular: PDFFont, bold: PDFFont, details: StampDetails, placement: StampPlacement | null) {
  const scale = Math.max(0.25, placement?.scale ?? DEFAULT_STAMP_SCALE);
  const lines = stampLines(details);

  const embedded = details.image ? (details.image.type === "png" ? await pdf.embedPng(details.image.bytes) : await pdf.embedJpg(details.image.bytes)) : null;
  const base = stampGeometry(lines, regular, bold, embedded ? embedded.height / embedded.width : null);

  const width = base.width * scale;
  const height = base.height * scale;
  const textHeight = base.textHeight * scale;
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const { x, y } = stampOrigin(pageWidth, pageHeight, width, height, placement);

  // The text box sits at the bottom of the block, the artwork above it —
  // the same order the positioner previews.
  page.drawRectangle({
    x,
    y,
    width: base.textWidth * scale,
    height: textHeight,
    borderColor: BORDER,
    borderWidth: BORDER_WIDTH * scale,
    color: rgb(1, 1, 1),
    opacity: 0.92,
  });

  let cursor = y + textHeight - PADDING * scale;
  lines.forEach((l) => {
    cursor -= (l.size + LEADING) * scale;
    page.drawText(l.text, { x: x + PADDING * scale, y: cursor, size: l.size * scale, font: l.bold ? bold : regular, color: TEXT });
  });

  if (embedded) {
    page.drawImage(embedded, {
      x,
      y: y + textHeight + base.gap * scale,
      width: base.imageWidth * scale,
      height: base.imageHeight * scale,
      opacity: 0.95,
    });
  }
}

// Stamps every page of a PDF. Returns null rather than throwing if the
// bytes aren't a PDF we can open — a document uploaded as something else
// simply goes into the bundle unstamped, which is better than failing the
// whole download.
export async function stampPdf(bytes: Uint8Array, details: StampDetails, placement: StampPlacement | null = null): Promise<Uint8Array | null> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      await drawStamp(pdf, page, regular, bold, details, placement);
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
  const page = pdf.addPage([300, 220]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  await drawStamp(pdf, page, regular, bold, details, null);
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
