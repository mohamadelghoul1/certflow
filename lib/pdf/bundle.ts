import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { stampPdf, type StampDetails } from "@/lib/pdf/stamp";

// One PDF containing the whole approval: a contents page, then the signed
// approval itself, then every approved document behind it in checklist
// order — the set a builder or a council would be handed, rather than a
// folder of separate downloads.

export type BundleDocument = {
  title: string;
  preparedBy?: string | null;
  reference?: string | null;
  revision?: string | null;
  date?: string | null;
  // Absent for a document with no file uploaded, or one we can't read.
  bytes?: Uint8Array | null;
  contentType?: string | null;
  stamp?: boolean;
};

export type BundleInput = {
  heading: string;
  subheading: string;
  // The signed approval, when one has been uploaded as a PDF. Word
  // documents can't be merged into a PDF without converting them first,
  // so a .docx approval is noted on the contents page instead.
  approval?: { bytes: Uint8Array; contentType?: string | null } | null;
  documents: BundleDocument[];
  stampDetails: StampDetails;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.8, 0.83, 0.86);

function isPdf(bytes: Uint8Array | null | undefined, contentType?: string | null) {
  if (!bytes || bytes.length < 5) return false;
  if (contentType && contentType.includes("pdf")) return true;
  // "%PDF-" — trust the file's own header over the content type, which is
  // whatever the browser guessed at upload time.
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function imageKind(bytes: Uint8Array | null | undefined): "png" | "jpeg" | null {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  return null;
}

// Copies every page of one PDF into the bundle. Anything unreadable is
// reported back so the contents page can say so rather than the document
// silently going missing.
async function appendPdf(bundle: PDFDocument, bytes: Uint8Array): Promise<boolean> {
  try {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await bundle.copyPages(source, source.getPageIndices());
    for (const page of pages) bundle.addPage(page);
    return true;
  } catch {
    return false;
  }
}

// A photo or scan gets a page of its own, sized to fit the sheet.
async function appendImage(bundle: PDFDocument, bytes: Uint8Array, kind: "png" | "jpeg"): Promise<boolean> {
  try {
    const embedded = kind === "png" ? await bundle.embedPng(bytes) : await bundle.embedJpg(bytes);
    const page = bundle.addPage(A4);
    const maxWidth = A4[0] - MARGIN * 2;
    const maxHeight = A4[1] - MARGIN * 2;
    const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, { x: (A4[0] - width) / 2, y: (A4[1] - height) / 2, width, height });
    return true;
  } catch {
    return false;
  }
}

export async function buildApprovalBundle(input: BundleInput): Promise<Uint8Array> {
  const bundle = await PDFDocument.create();
  const regular = await bundle.embedFont(StandardFonts.Helvetica);
  const bold = await bundle.embedFont(StandardFonts.HelveticaBold);

  // Built after everything else so it can report what actually made it in,
  // then moved to the front.
  const notes: { title: string; detail: string; included: boolean }[] = [];

  if (input.approval) {
    const ok = isPdf(input.approval.bytes, input.approval.contentType) && (await appendPdf(bundle, input.approval.bytes));
    notes.push({
      title: "Approval",
      detail: ok ? "Included" : "Not included — the signed approval is not a PDF. Save it as PDF and upload it again to have it lead this bundle.",
      included: ok,
    });
  } else {
    notes.push({ title: "Approval", detail: "Not included — no signed approval has been uploaded for this job yet.", included: false });
  }

  for (const doc of input.documents) {
    let bytes = doc.bytes || null;
    let included = false;
    let detail = "Not included — no file has been uploaded against this item.";

    if (bytes && isPdf(bytes, doc.contentType)) {
      if (doc.stamp) {
        const stamped = await stampPdf(bytes, input.stampDetails);
        if (stamped) bytes = stamped;
      }
      included = await appendPdf(bundle, bytes);
      detail = included ? (doc.stamp ? "Included — stamped" : "Included") : "Not included — the file could not be read.";
    } else if (bytes) {
      const kind = imageKind(bytes);
      if (kind) {
        included = await appendImage(bundle, bytes, kind);
        detail = included ? "Included" : "Not included — the image could not be read.";
      } else {
        detail = "Not included — only PDFs and images can be combined. Save this document as a PDF and upload it again.";
      }
    }

    notes.push({ title: doc.title, detail, included });
  }

  // Contents page, inserted at the front.
  const cover = bundle.insertPage(0, A4);
  let y = A4[1] - MARGIN;

  cover.drawText(input.heading, { x: MARGIN, y: y - 16, size: 16, font: bold, color: INK });
  y -= 34;
  cover.drawText(input.subheading, { x: MARGIN, y: y - 10, size: 9, font: regular, color: MUTED });
  y -= 30;
  cover.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1, color: LINE });
  y -= 22;

  const columns = [MARGIN, MARGIN + 150, MARGIN + 300, MARGIN + 372, MARGIN + 430];
  const headers = ["Prepared by", "Document", "Reference no.", "Revision", "Date"];
  headers.forEach((h, i) => cover.drawText(h, { x: columns[i], y, size: 8, font: bold, color: MUTED }));
  y -= 14;

  // Wraps a value into the width its column has, so a long document title
  // doesn't run underneath the next column.
  function fit(text: string, width: number, size: number) {
    const lines: string[] = [];
    let current = "";
    for (const word of text.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  const widths = [140, 140, 62, 48, 70];

  for (let i = 0; i < input.documents.length; i++) {
    const doc = input.documents[i];
    const note = notes.find((n) => n.title === doc.title);
    const cells = [doc.preparedBy || "—", doc.title, doc.reference || "—", doc.revision || "—", doc.date || "—"];
    const wrapped = cells.map((c, ci) => fit(c, widths[ci], 8));
    const rowLines = Math.max(...wrapped.map((w) => w.length));
    const statusLines = note && !note.included ? fit(note.detail, A4[0] - MARGIN * 2, 7) : [];

    if (y - (rowLines + statusLines.length) * 10 < MARGIN + 20) break;

    wrapped.forEach((linesForCell, ci) => {
      linesForCell.forEach((text, li) => {
        cover.drawText(text, { x: columns[ci], y: y - li * 10, size: 8, font: regular, color: INK });
      });
    });
    y -= rowLines * 10;

    statusLines.forEach((text, li) => {
      cover.drawText(text, { x: MARGIN + 8, y: y - li * 9, size: 7, font: regular, color: MUTED });
    });
    y -= statusLines.length * 9 + 8;
  }

  const approvalNote = notes[0];
  if (approvalNote && !approvalNote.included && y > MARGIN + 30) {
    y -= 6;
    cover.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: LINE });
    y -= 14;
    fit(approvalNote.detail, A4[0] - MARGIN * 2, 8).forEach((text, li) => {
      cover.drawText(text, { x: MARGIN, y: y - li * 10, size: 8, font: regular, color: MUTED });
    });
  }

  return bundle.save();
}
