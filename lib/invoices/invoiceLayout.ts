import { formatISODate, letterheadAddressLines } from "@/lib/business";
import { invoiceNumberOf, invoiceTotals, formatMoney } from "@/lib/invoices/invoiceLogic";
import type { Letterhead } from "@/lib/letterhead";
import type { Invoice, InvoiceLine } from "@/types/db";

// What a tax invoice says, worked out once.
//
// The same invoice is drawn twice — as the PDF that goes out attached to
// the email and sits on the client's portal, and as the page the
// certifier prints from their own screen. Those are two different
// drawing engines with nothing in common, and when each decided for
// itself what the blocks said they drifted: a heading reworded on one
// and not the other, a paid invoice that said so in one place only.
//
// So the words, the order and the arithmetic are settled here, and both
// renderers are left with nothing to do but place them.

export type InvoiceRecipient = { email?: string | null; phone?: string | null } | null;

export type InvoiceFact = { label: string; value: string };
export type InvoiceItem = { description: string; tax: string; amount: string };
export type InvoiceTotal = { label: string; value: string; strong?: boolean; ruleBefore?: boolean };

export type InvoiceView = {
  number: string;
  // Who it is for, then who it is from — the two facing blocks under the
  // title.
  billTo: string[];
  firmLines: string[];
  // The figure the client is looking for, and the date it is wanted by.
  headline: { label: string; value: string; dueLabel: string; dueValue: string };
  // Paid or cancelled, said plainly. Null on an ordinary open invoice:
  // a document that has nothing to declare should declare nothing.
  status: { text: string; paid: boolean } | null;
  facts: InvoiceFact[];
  items: InvoiceItem[];
  totals: InvoiceTotal[];
  notes: string | null;
  paymentDetails: string | null;
  payUrl: string | null;
  surcharge: string | null;
};

const GST_RATE_LABEL = "10%";

// The client's own email and phone belong on the invoice, and nobody
// should have to type them twice: they are already on the client record
// the invoice was raised against. Added only when the certifier has not
// typed them into the address block themselves.
function withContact(lines: string[], recipient: InvoiceRecipient): string[] {
  const out = [...lines];
  const written = out.join(" ").toLowerCase();
  const email = (recipient?.email || "").trim();
  const phone = (recipient?.phone || "").trim();
  if (email && !written.includes(email.toLowerCase())) out.push(email);
  const digits = phone.replace(/\D/g, "");
  if (phone && digits && !written.replace(/\D/g, "").includes(digits)) out.push(phone);
  return out;
}

export function invoiceView({
  firm,
  invoice,
  lines,
  recipient = null,
}: {
  firm: Letterhead | null;
  invoice: Invoice;
  lines: InvoiceLine[];
  recipient?: InvoiceRecipient;
}): InvoiceView {
  const { subtotal, gst, total } = invoiceTotals(lines);
  const number = invoiceNumberOf(invoice);
  const paid = invoice.status === "paid";
  const voided = invoice.status === "void";

  const billTo = withContact(
    String(invoice.bill_to || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    recipient
  );

  const firmLines: string[] = [];
  if (firm?.name) firmLines.push(firm.name);
  letterheadAddressLines(firm?.office_address)
    .filter((line) => line && line !== "—")
    .forEach((line, i) => firmLines.push(i === 0 ? `A: ${line}` : line));
  if (firm?.phone) firmLines.push(`M: ${firm.phone}`);
  if (firm?.email) firmLines.push(`E: ${firm.email}`);
  if (firm?.abn) firmLines.push(`ABN: ${firm.abn}`);

  // A cancelled invoice asks for nothing, so it shows no figure to pay
  // and no date to pay it by. A paid one keeps its figure, under a label
  // that says the money has already arrived.
  const headline = {
    label: paid ? "Amount paid" : "Amount due",
    value: voided ? "—" : formatMoney(total),
    dueLabel: "Due date",
    dueValue: voided || !invoice.due_date ? "—" : formatISODate(invoice.due_date),
  };

  const status = paid
    ? { text: invoice.paid_date ? `Paid ${formatISODate(invoice.paid_date)}` : "Paid", paid: true }
    : voided
      ? { text: "Void — this invoice has been cancelled", paid: false }
      : null;

  const facts: InvoiceFact[] = [
    { label: "Issue date", value: formatISODate(invoice.issue_date) },
    { label: "Invoice number", value: number },
  ];
  if (invoice.reference) facts.push({ label: "Reference", value: invoice.reference });

  const items: InvoiceItem[] = lines.map((line) => ({
    description: line.description || "—",
    tax: GST_RATE_LABEL,
    amount: formatMoney(Number(line.amount) || 0),
  }));

  const totals: InvoiceTotal[] = [
    { label: "Subtotal", value: formatMoney(subtotal) },
    { label: `Total GST ${GST_RATE_LABEL}`, value: formatMoney(gst) },
    { label: "Total", value: formatMoney(total), ruleBefore: true },
    { label: headline.label, value: headline.value, strong: true, ruleBefore: true },
  ];

  const surchargeAmount = Number(invoice.card_surcharge) || 0;
  const surcharge =
    invoice.stripe_payment_link_url && surchargeAmount
      ? `Card payments carry a ${formatMoney(surchargeAmount)} processing surcharge (total ${formatMoney(
          total + surchargeAmount
        )}); bank transfer avoids it.`
      : null;

  return {
    number,
    billTo,
    firmLines,
    headline,
    status,
    facts,
    items,
    totals,
    notes: invoice.notes?.trim() || null,
    paymentDetails: invoice.payment_details?.trim() || null,
    // Nothing to pay on a cancelled invoice, and nothing to pay twice on
    // a settled one.
    payUrl: paid || voided ? null : invoice.stripe_payment_link_url || null,
    surcharge: paid || voided ? null : surcharge,
  };
}
