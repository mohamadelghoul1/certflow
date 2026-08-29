import { escapeHtml } from "@/lib/html";
import { formatISODate } from "@/lib/business";
import { formatMoney, invoiceTotals } from "@/lib/invoices/invoiceLogic";
import type { InvoiceLine } from "@/types/db";

// The body of the invoice email.
//
// Its own function so it can be read and tested on its own: this is the
// one document a client is asked to act on, it goes out under the firm's
// name, and a mistake in it is a mistake in front of a paying customer.

export type InvoiceEmailInput = {
  clientName: string | null;
  invoiceNumber: string;
  reference: string | null;
  lines: InvoiceLine[];
  dueDate: string | null;
  paymentLinkUrl: string | null;
  cardSurcharge: number | null;
  paymentDetails: string | null;
  notes: string | null;
  portalUrl: string;
  firmName: string | null;
};

export function invoiceEmailHtml(input: InvoiceEmailInput): string {
  const { subtotal, gst, total } = invoiceTotals(input.lines);
  const rows = input.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 12px 6px 0">${escapeHtml(l.description)}</td><td style="padding:6px 0;text-align:right">${formatMoney(
          Number(l.amount) || 0
        )}</td></tr>`
    )
    .join("");

  return [
    `<p>Hi ${escapeHtml(input.clientName || "there")},</p>`,
    `<p>Please find our invoice <strong>${escapeHtml(input.invoiceNumber)}</strong>${
      input.reference ? ` for <strong>${escapeHtml(input.reference)}</strong>` : ""
    } below.</p>`,
    `<table style="border-collapse:collapse;font-size:14px">${rows}`,
    `<tr><td style="padding:6px 12px 6px 0;border-top:1px solid #ddd">Subtotal</td><td style="padding:6px 0;text-align:right;border-top:1px solid #ddd">${formatMoney(
      subtotal
    )}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0">GST (10%)</td><td style="padding:6px 0;text-align:right">${formatMoney(gst)}</td></tr>`,
    `<tr><td style="padding:6px 12px 6px 0;font-weight:bold">Total due</td><td style="padding:6px 0;text-align:right;font-weight:bold">${formatMoney(
      total
    )}</td></tr></table>`,
    // Written the way it is on the attached PDF and in the portal. It
    // used to print the raw database value — "2026-09-12" — which reads
    // as a serial number rather than a date, and disagreed with the very
    // PDF travelling with it.
    input.dueDate ? `<p>Payment is due by <strong>${formatISODate(input.dueDate)}</strong>.</p>` : "",
    input.paymentLinkUrl
      ? `<p><a href="${input.paymentLinkUrl}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold">Pay online by card</a>${
          input.cardSurcharge
            ? `<br/><span style="font-size:12px;color:#64748b">Card payments carry a ${formatMoney(
                Number(input.cardSurcharge)
              )} processing surcharge (total ${formatMoney(total + Number(input.cardSurcharge))}); paying by bank transfer avoids it.</span>`
            : ""
        }</p>`
      : "",
    input.paymentDetails
      ? `<p style="padding:10px 12px;background:#f8fafc;border-radius:6px;white-space:pre-line">${escapeHtml(input.paymentDetails)}</p>`
      : "",
    input.notes ? `<p>${escapeHtml(input.notes)}</p>` : "",
    `<p>A PDF copy is attached. You can also view, download and pay this invoice at any time in your client portal: <a href="${input.portalUrl}/portal">${input.portalUrl}/portal</a>.</p>`,
    `<p>Kind regards,<br/>${escapeHtml(input.firmName || "")}</p>`,
  ].join("");
}
