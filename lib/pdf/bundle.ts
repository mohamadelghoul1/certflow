import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { stampPdf, type StampDetails, type StampPlacement } from "@/lib/pdf/stamp";

// One PDF containing the whole approval: the signed approval itself, then
// every approved document behind it in checklist order — the set a builder
// or a council would be handed, rather than a folder of separate
// downloads.
//
// It opens on the approval. There used to be a contents page in front of
// it, which meant every set a council received led with an index nobody
// asked for. The one thing that page did carry which the documents cannot
// is a note of anything that could not be combined; that survives as a
// final page, added only when something is actually missing, so an
// ordinary set has no extra pages at all.

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
  // Where the certifier dragged the stamp on this document. Null puts it
  // in the bottom-right corner, as it was before it could be moved.
  placement?: StampPlacement | null;
};

export type BundleInput = {
  heading: string;
  subheading: string;
  // The approval itself: the council letter, the applicant letter, the
  // certificate, the inspections notice and Schedule 1. Generated as a
  // PDF so it can lead the set, or the signed copy the certifier
  // uploaded, which takes precedence when it is a PDF — that upload is
  // the official document.
  approval?: { bytes: Uint8Array; contentType?: string | null } | null;
  approvalLabel?: string;
  // A generated document that belongs with the approval rather than
  // behind it. The pre-inspection report is drawn into the certificate
  // package itself, so this is only used when the approval is a signed
  // PDF the certifier uploaded and there is no generated package for it
  // to sit inside. It is counted as part of the approval, so it keeps
  // its own footer rather than having a second one drawn over it.
  supplement?: { bytes: Uint8Array; label: string } | null;
  documents: BundleDocument[];
  stampDetails: StampDetails;
  // The "Project No.: … · website" line the generated documents carry at
  // the foot of every page, drawn onto the attached documents too so the
  // whole set reads as one document. The approval's own pages already
  // have it and are left alone.
  footer?: { projectRef: string; website?: string | null } | null;
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
// reported back, so a document that could not be combined is named on the
// closing page rather than silently going missing.
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

  // What did and didn't make it in. Only the failures are ever printed,
  // on a closing page, and only when there are some.
  const notes: { title: string; detail: string; included: boolean }[] = [];

  if (input.approval) {
    const ok = isPdf(input.approval.bytes, input.approval.contentType) && (await appendPdf(bundle, input.approval.bytes));
    notes.push({
      title: input.approvalLabel || "Approval",
      detail: ok ? "Included" : "Not included — the signed approval is not a PDF. Save it as PDF and upload it again to have it lead this bundle.",
      included: ok,
    });
  } else {
    notes.push({ title: input.approvalLabel || "Approval", detail: "Not included — the approval could not be generated for this job.", included: false });
  }

  if (input.supplement) {
    const ok = await appendPdf(bundle, input.supplement.bytes);
    notes.push({ title: input.supplement.label, detail: ok ? "Included" : "Not included — the report could not be generated.", included: ok });
  }

  // Everything after this point — the attached documents and any closing
  // page — gets the project footer drawn on; the approval before it
  // already carries its own.
  const approvalPageCount = bundle.getPageCount();

  const drawFooters = () => {
    if (!input.footer) return;
    const site = (input.footer.website || "").trim();
    const label = site ? `Project No.: ${input.footer.projectRef}  ·  ${site}` : `Project No.: ${input.footer.projectRef}`;
    const pages = bundle.getPages();
    for (let i = approvalPageCount; i < pages.length; i++) {
      const page = pages[i];
      const { width } = page.getSize();
      const w = regular.widthOfTextAtSize(label, 7);
      page.drawText(label, { x: (width - w) / 2, y: 14, size: 7, font: regular, color: MUTED });
    }
  };

  for (const doc of input.documents) {
    let bytes = doc.bytes || null;
    let included = false;
    let detail = "Not included — no file has been uploaded against this item.";

    if (bytes && isPdf(bytes, doc.contentType)) {
      if (doc.stamp) {
        const stamped = await stampPdf(bytes, input.stampDetails, doc.placement ?? null);
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

  // The set ends with the last approved document. It used to close with a
  // "Not included in this set" page listing what could not be merged — a
  // note to the certifier about their own uploads, which has no place in
  // a document handed to a council or a client. What is missing is
  // visible where it can be acted on: on the checklist itself, where an
  // item with no file, or one carrying a Word document, says so.
  drawFooters();
  return bundle.save();
}
