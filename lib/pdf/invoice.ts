import { Layout, LETTER_BODY_SIZE, MARGIN, A4, INK, MUTED, TITLE_SIZE, HEADING_COLOR, TABLE_HEADER_FILL } from "@/lib/pdf/layout";
import { letterheadHeader, documentFooter, type PackageImages } from "@/lib/pdf/letterhead";
import { invoiceTotals, invoiceNumberOf, formatMoney } from "@/lib/invoices/invoiceLogic";
import { formatISODate } from "@/lib/business";
import type { Letterhead } from "@/lib/letterhead";
import type { Invoice, InvoiceLine } from "@/types/db";

// The tax invoice as a real PDF, on the firm's own letterhead.
//
// There was already a printed invoice — a web page with a Save as PDF
// button on it. That is fine for the certifier at their desk and no use
// at all for the two places an invoice actually has to go: attached to
// the email that asks for payment, and downloadable from the client's
// portal. Both need a file, built on the server, without a person
// standing at a print dialog. Same numbers, same order, same letterhead
// as the printed page, so a client who sees both sees one document.

export type InvoiceDocumentData = {
  firm: Letterhead | null;
  invoice: Invoice;
  lines: InvoiceLine[];
};

const LABEL_SIZE = 9;

export async function buildInvoicePdf(data: InvoiceDocumentData, images: PackageImages): Promise<Uint8Array> {
  const { firm, invoice, lines } = data;
  const { subtotal, gst, total } = invoiceTotals(lines);
  const number = invoiceNumberOf(invoice);

  const l = await Layout.create();
  const logo = images.logo ? await (images.logo.type === "png" ? l.doc.embedPng(images.logo.bytes) : l.doc.embedJpg(images.logo.bytes)) : null;
  l.header = letterheadHeader(firm, logo);
  l.footer = documentFooter(`Invoice ${number}`, firm?.website);
  l.newPage();

  l.text("TAX INVOICE", { size: TITLE_SIZE, bold: true, color: HEADING_COLOR, align: "center", gapAfter: 4 });
  l.rule();

  // The two blocks that head every invoice: who it is for on the left,
  // when it is due on the right. Drawn side by side from a single top,
  // so neither pushes the other down the page.
  const half = l.contentWidth / 2 - 6;
  const top = l.y;
  const leftLines: [string, string][] = [["Invoice number:", number]];
  if (invoice.bill_to) leftLines.push(["Bill to:", invoice.bill_to]);
  if (invoice.reference) leftLines.push(["Re:", invoice.reference]);
  const rightLines: [string, string][] = [["Issued:", formatISODate(invoice.issue_date)]];
  if (invoice.due_date) rightLines.push(["Due:", formatISODate(invoice.due_date)]);
  if (invoice.status === "paid" && invoice.paid_date) rightLines.push(["Paid:", formatISODate(invoice.paid_date)]);
  if (invoice.status === "void") rightLines.push(["Status:", "VOID"]);

  const column = (rows: [string, string][], x: number) => {
    l.y = top;
    for (const [label, value] of rows) l.inline([{ text: `${label} `, bold: true }, { text: value }], { size: LABEL_SIZE, x, width: half, gapAfter: 1 });
    return l.y;
  };
  const leftBottom = column(leftLines, MARGIN);
  const rightBottom = column(rightLines, MARGIN + half + 12);
  l.y = Math.min(leftBottom, rightBottom) - 10;

  l.table(
    ["Description", "Amount (ex GST)"],
    lines.map((line) => [line.description || "—", formatMoney(Number(line.amount) || 0)]),
    [76, 24],
    { headerFill: TABLE_HEADER_FILL, rightColumns: [1] }
  );

  // The totals sit hard against the right edge, under the amount column:
  // label and figure both right-aligned, the payable total in bold.
  const totalRow = (label: string, amount: number, bold?: boolean) => {
    const size = bold ? LETTER_BODY_SIZE : LABEL_SIZE;
    const lead = size * 1.4;
    l.ensure(lead);
    l.y -= lead;
    const figure = formatMoney(amount);
    const font = l.font(bold);
    const figureWidth = font.widthOfTextAtSize(figure, size);
    // Lined up with the figures inside the table above, which sit one
    // cell's padding in from its right border.
    const right = A4[0] - MARGIN - 4.25;
    l.page.drawText(figure, { x: right - figureWidth, y: l.y, size, font, color: INK });
    const labelWidth = font.widthOfTextAtSize(label, size);
    l.page.drawText(label, { x: right - figureWidth - 14 - labelWidth, y: l.y, size, font, color: bold ? INK : MUTED });
  };
  totalRow("Subtotal", subtotal);
  totalRow("GST (10%)", gst);
  totalRow("Total due", total, true);
  l.y -= 14;

  if (invoice.payment_details || invoice.stripe_payment_link_url) {
    l.text("Payment details", { size: LABEL_SIZE, bold: true, gapAfter: 2 });
    if (invoice.payment_details) l.text(invoice.payment_details, { size: LABEL_SIZE, gapAfter: 3 });
    if (invoice.stripe_payment_link_url) {
      l.text(`Pay online by card: ${invoice.stripe_payment_link_url}`, { size: LABEL_SIZE, gapAfter: 2 });
      if (invoice.card_surcharge) {
        l.text(
          `Card payments carry a ${formatMoney(Number(invoice.card_surcharge))} processing surcharge (total ${formatMoney(
            total + Number(invoice.card_surcharge)
          )}); bank transfer avoids it.`,
          { size: LABEL_SIZE, color: MUTED, gapAfter: 3 }
        );
      }
    }
    l.y -= 6;
  }

  if (invoice.notes) l.text(invoice.notes, { size: LABEL_SIZE, gapAfter: 10 });

  l.text("Kind Regards", { size: LABEL_SIZE, gapAfter: 1 });
  l.text(firm?.name || "", { size: LABEL_SIZE, bold: true });

  return l.save();
}
