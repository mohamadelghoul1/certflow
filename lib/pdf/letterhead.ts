import type { PDFImage } from "pdf-lib";
import { Layout, MARGIN, MARGIN_BOTTOM, HEADER_TOP, A4, TITLE_SIZE, BODY_SIZE, SMALL_SIZE, MUTED, LINE, HEADING_COLOR } from "@/lib/pdf/layout";
import { letterheadAddressLines } from "@/lib/business";
import type { Letterhead } from "@/lib/letterhead";

// The firm's letterhead and the project footer, drawn on every page of a
// generated PDF. Shared so the certificate package and the documents that
// travel with it — currently the pre-inspection report — carry an
// identical head and foot rather than two that drift apart. The Word side
// splits the same way, in lib/docx/pathwayCertificate.ts.

// The firm's logo and the certifier's signature, already fetched as
// bytes ready for pdf-lib to embed.
export type PackageImages = { logo?: { bytes: Uint8Array; type: "png" | "jpeg" } | null; signature?: { bytes: Uint8Array; type: "png" | "jpeg" } | null };

export function letterheadHeader(firm: Letterhead | null, logo: PDFImage | null) {
  return (layout: Layout) => {
    const top = A4[1] - HEADER_TOP;
    let leftBottom = top;

    if (logo) {
      const height = 34;
      const width = logo.width * (height / logo.height);
      layout.page.drawImage(logo, { x: MARGIN, y: top - height, width, height });
      leftBottom = top - height;
    } else {
      layout.page.drawText(firm?.name || "", { x: MARGIN, y: top - TITLE_SIZE, size: TITLE_SIZE, font: layout.bold, color: HEADING_COLOR });
      leftBottom = top - TITLE_SIZE - 3;
    }
    // The ABN and contact block read as the certificate's own small print
    // (SMALL_SIZE, 7pt) — noticeably smaller than everything else on the
    // page, including the field values just below it. Set at BODY_SIZE
    // instead, the same size the certificate's own fields use, so the
    // letterhead reads as part of the same document rather than a caption
    // under it. The footer below keeps SMALL_SIZE — that one is genuinely
    // meant to sit quietly under every page.
    const HEADER_DETAIL_SIZE = BODY_SIZE;
    layout.page.drawText(`ABN: ${firm?.abn || "—"}`, { x: MARGIN, y: leftBottom - HEADER_DETAIL_SIZE - 2, size: HEADER_DETAIL_SIZE, font: layout.regular, color: MUTED });

    const right: string[] = [];
    letterheadAddressLines(firm?.postal_address).forEach((line, i) => right.push(i === 0 ? `Postal: ${line}` : line));
    letterheadAddressLines(firm?.office_address).forEach((line, i) => right.push(i === 0 ? `Office: ${line}` : line));
    right.push(`(p): ${firm?.phone || "—"}`, `(e): ${firm?.email || "—"}`);
    const lead = HEADER_DETAIL_SIZE * 1.32;
    right.forEach((line, i) => {
      const w = layout.regular.widthOfTextAtSize(line, HEADER_DETAIL_SIZE);
      layout.page.drawText(line, { x: A4[0] - MARGIN - w, y: top - HEADER_DETAIL_SIZE - i * lead, size: HEADER_DETAIL_SIZE, font: layout.regular, color: MUTED });
    });

    const ruleY = Math.min(leftBottom - HEADER_DETAIL_SIZE - 10, top - HEADER_DETAIL_SIZE - right.length * lead - 4);
    layout.page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: A4[0] - MARGIN, y: ruleY }, thickness: 0.5, color: LINE });
    layout.y = ruleY - 14;
  };
}

export function projectFooter(projRef: string, website?: string | null) {
  return documentFooter(`Project No.: ${projRef}`, website);
}

// The same footer, for a document that isn't about a project number —
// an invoice carries its own number instead.
export function documentFooter(reference: string, website?: string | null) {
  return (layout: Layout) => {
    const site = (website || "").trim();
    const label = site ? `${reference}  ·  ${site}` : reference;
    const y = MARGIN_BOTTOM - 12;
    layout.page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: A4[0] - MARGIN, y: y + 12 }, thickness: 0.5, color: LINE });
    const w = layout.regular.widthOfTextAtSize(label, SMALL_SIZE);
    layout.page.drawText(label, { x: (A4[0] - w) / 2, y, size: SMALL_SIZE, font: layout.regular, color: MUTED });
  };
}
