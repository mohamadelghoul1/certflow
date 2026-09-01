import { rgb, type RGB } from "pdf-lib";
import { Layout, MARGIN, MARGIN_BOTTOM, MARGIN_TOP, A4, INK, MUTED, LINE } from "@/lib/pdf/layout";
import { documentFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { invoiceView, type InvoiceRecipient, type InvoiceView } from "@/lib/invoices/invoiceLayout";
import type { Letterhead } from "@/lib/letterhead";
import type { Invoice, InvoiceLine } from "@/types/db";

// The tax invoice as a real PDF, laid out the way an accounting system
// lays one out — because that is the shape a builder's bookkeeper reads
// without having to look for anything.
//
// The figure owed and the date it is owed by are the two things anybody
// opening an invoice is looking for, so they are set large, near the
// top, before the detail. Everything else follows in the order it gets
// used: who it is for and who it is from, then the reference numbers,
// then the fees, then the totals, then how to pay.
//
// Same words and same arithmetic as the page the certifier prints from
// their screen — both are placing what lib/invoices/invoiceLayout.ts
// worked out, so the client and the certifier are always looking at one
// document.

export type InvoiceDocumentData = {
  firm: Letterhead | null;
  invoice: Invoice;
  lines: InvoiceLine[];
  recipient?: InvoiceRecipient;
};

const TITLE_SIZE = 22;
const HEADLINE_SIZE = 17;
const BODY = 9.5;
const LABEL = 8.5;
const ROW_LEAD = 12.5;

// The sage rule under the head of the document, and the green a settled
// invoice says "Paid" in.
const ACCENT = rgb(0xb8 / 255, 0xb4 / 255, 0x9a / 255);
const PAID = rgb(0x15 / 255, 0x7f / 255, 0x3c / 255);

function rightText(l: Layout, text: string, right: number, y: number, size: number, color: RGB, bold?: boolean) {
  const font = l.font(bold);
  l.page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function hairline(l: Layout, from: number, to: number, color: RGB = LINE, thickness = 0.5) {
  l.page.drawLine({ start: { x: from, y: l.y }, end: { x: to, y: l.y }, thickness, color });
}

export async function buildInvoicePdf(data: InvoiceDocumentData, images: PackageImages): Promise<Uint8Array> {
  const { firm, invoice, lines } = data;
  const view = invoiceView({ firm, invoice, lines, recipient: data.recipient ?? null });

  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.footer = documentFooter(`Invoice ${view.number}`, firm?.website);
  l.newPage();

  const rightEdge = A4[0] - MARGIN;

  // ---- The masthead: the name of the document on the left, the firm's
  // mark on the right, the way every invoice a client has ever paid is
  // headed.
  const top = A4[1] - MARGIN_TOP;
  l.page.drawText("Tax Invoice", { x: MARGIN, y: top - TITLE_SIZE, size: TITLE_SIZE, font: l.bold, color: INK });
  let mastheadBottom = top - TITLE_SIZE - 4;
  if (logo) {
    const height = 46;
    const width = logo.width * (height / logo.height);
    l.page.drawImage(logo, { x: rightEdge - width, y: top - height, width, height });
    mastheadBottom = Math.min(mastheadBottom, top - height);
  }
  l.y = mastheadBottom - 26;

  // ---- Bill to, facing the firm's own details.
  const columnTop = l.y;
  const half = l.contentWidth / 2 - 12;
  l.text("Bill to", { size: LABEL, bold: true, width: half, gapAfter: 3 });
  if (view.billTo.length === 0) l.text("—", { size: BODY, width: half, gapAfter: 1 });
  view.billTo.forEach((line) => l.text(line, { size: BODY, width: half, gapAfter: 1.5 }));
  const billToBottom = l.y;

  l.y = columnTop;
  view.firmLines.forEach((line, i) =>
    l.text(line, { size: LABEL, x: rightEdge - half, width: half, align: "right", color: i === 0 ? INK : MUTED, bold: i === 0, gapAfter: 1.5 })
  );
  l.y = Math.min(billToBottom, l.y) - 26;

  // ---- The two figures the client opened the file for.
  const dueX = MARGIN + 190;
  l.page.drawText(view.headline.label, { x: MARGIN, y: l.y, size: LABEL, font: l.regular, color: MUTED });
  l.page.drawText(view.headline.dueLabel, { x: dueX, y: l.y, size: LABEL, font: l.regular, color: MUTED });
  l.y -= HEADLINE_SIZE + 6;
  l.page.drawText(view.headline.value, { x: MARGIN, y: l.y, size: HEADLINE_SIZE, font: l.bold, color: INK });
  l.page.drawText(view.headline.dueValue, { x: dueX, y: l.y, size: HEADLINE_SIZE, font: l.bold, color: INK });
  l.y -= 20;

  if (view.status) {
    l.page.drawText(view.status.text, { x: MARGIN, y: l.y, size: BODY, font: l.bold, color: view.status.paid ? PAID : MUTED });
    l.y -= 18;
  }

  // ---- Issue date, number, reference: three columns across the page.
  const factX = [MARGIN, MARGIN + 130, MARGIN + 260];
  const factWidth = [120, 120, l.contentWidth - 260];
  const factTop = l.y;
  let factDepth = 0;
  view.facts.forEach((fact, i) => {
    const x = factX[i] ?? MARGIN;
    const width = factWidth[i] ?? 120;
    l.page.drawText(fact.label, { x, y: factTop, size: LABEL, font: l.regular, color: MUTED });
    const valueLines = l.wrap(fact.value, width, BODY, true);
    valueLines.forEach((line, row) => l.page.drawText(line, { x, y: factTop - 14 - row * ROW_LEAD, size: BODY, font: l.bold, color: INK }));
    factDepth = Math.max(factDepth, 14 + valueLines.length * ROW_LEAD);
  });
  l.y = factTop - factDepth - 12;

  hairline(l, MARGIN, rightEdge, ACCENT, 2);
  l.y -= 20;

  // ---- The fees. Ruled between rows rather than boxed: a bordered grid
  // reads as a form to fill in, and this is a statement to be read.
  const amountRight = rightEdge;
  const taxRight = rightEdge - 86;
  const descriptionWidth = taxRight - 40 - MARGIN;

  const itemsHeader = () => {
    l.page.drawText("Description", { x: MARGIN, y: l.y, size: LABEL, font: l.regular, color: MUTED });
    rightText(l, "Tax", taxRight, l.y, LABEL, MUTED);
    rightText(l, "Amount", amountRight, l.y, LABEL, MUTED);
    l.y -= 7;
    hairline(l, MARGIN, rightEdge);
    l.y -= 4;
  };
  itemsHeader();

  for (const item of view.items) {
    const descriptionLines = l.wrap(item.description, descriptionWidth, BODY);
    const height = descriptionLines.length * ROW_LEAD + 8;
    if (l.y - height < MARGIN_BOTTOM + 40) {
      l.newPage();
      l.y -= 6;
      itemsHeader();
    }
    const rowTop = l.y;
    descriptionLines.forEach((line, i) => l.page.drawText(line, { x: MARGIN, y: rowTop - ROW_LEAD - i * ROW_LEAD + 3, size: BODY, font: l.regular, color: INK }));
    rightText(l, item.tax, taxRight, rowTop - ROW_LEAD + 3, BODY, MUTED);
    rightText(l, item.amount, amountRight, rowTop - ROW_LEAD + 3, BODY, INK);
    l.y = rowTop - height;
    hairline(l, MARGIN, rightEdge);
  }

  // ---- Totals, stacked against the right edge under the amounts they
  // add up.
  l.y -= 14;
  const totalsLeft = rightEdge - 235;
  for (const row of view.totals) {
    const size = row.strong ? 13 : BODY;
    const lead = size * 1.5;
    if (l.y - lead - 12 < MARGIN_BOTTOM + 20) l.newPage();
    // The cursor is sitting on the previous row's baseline, so the rule
    // is dropped clear of it before it is drawn — otherwise it strikes
    // through the line above rather than dividing the two.
    if (row.ruleBefore) {
      l.y -= 8;
      hairline(l, totalsLeft, rightEdge);
      l.y -= 3;
    }
    l.y -= lead;
    l.page.drawText(row.label, { x: totalsLeft, y: l.y, size, font: l.font(row.strong), color: row.strong ? INK : MUTED });
    rightText(l, row.value, amountRight, l.y, size, INK, true);
  }

  // ---- How to pay, and anything else the certifier wrote. Left column
  // only, so it sits under the fees rather than beside the totals.
  l.y -= 30;
  const noteWidth = l.contentWidth * 0.62;
  if (view.notes) l.text(view.notes, { size: BODY, width: noteWidth, gapAfter: 8 });
  if (view.paymentDetails) l.text(view.paymentDetails, { size: BODY, width: noteWidth, gapAfter: 6, lineHeight: ROW_LEAD });
  if (view.payUrl) {
    l.text(`Pay online by card: ${view.payUrl}`, { size: BODY, width: noteWidth, gapAfter: 2 });
    if (view.surcharge) l.text(view.surcharge, { size: LABEL, color: MUTED, width: noteWidth, gapAfter: 2 });
  }

  return l.save();
}
