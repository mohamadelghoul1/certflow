import type { Invoice, InvoiceLine } from "@/types/db";

// The arithmetic and judgement around invoices, kept apart from the
// database so it can be tested to the cent. Money rendered wrong once is
// a client on the phone; rendered wrong systematically is an accountant.

export function invoiceTotals(lines: Pick<InvoiceLine, "amount">[]): { subtotal: number; gst: number; total: number } {
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  // Fees are entered ex-GST, as on quotes; GST is added at one tenth.
  const gst = Math.round(subtotal * 10) / 100;
  return { subtotal, gst, total: subtotal + gst };
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A sent invoice past its due date. Not a stored status — computed at
// the moment of asking, so it is always true today rather than as of
// whenever something last ran.
export function isOverdue(invoice: Pick<Invoice, "status" | "due_date">, todayIso: string): boolean {
  return invoice.status === "sent" && !!invoice.due_date && invoice.due_date < todayIso;
}

// The printed number. A firm can type its own; left blank, one is
// derived from the row's id the same way quotes derive theirs — stable,
// unique, and never colliding with the typed ones' INV- series.
export function invoiceNumberOf(invoice: Pick<Invoice, "invoice_number" | "id">): string {
  return invoice.invoice_number?.trim() || invoice.id.slice(0, 8).toUpperCase();
}

// The next number in the firm's own INV- series: one past the highest
// already used. Counting rows would repeat numbers after a void or a
// renumber; taking the highest never does.
export function nextInvoiceNumber(existing: (string | null)[]): string {
  let highest = 0;
  for (const number of existing) {
    const match = /^INV-(\d+)$/i.exec((number || "").trim());
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }
  return `INV-${String(highest + 1).padStart(4, "0")}`;
}

// What the list page owes its totals to: everything sent and unpaid,
// with the overdue slice called out.
export function receivablesSummary(
  invoices: (Pick<Invoice, "status" | "due_date"> & { total: number })[],
  todayIso: string
): { outstanding: number; overdue: number; overdueCount: number } {
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const invoice of invoices) {
    if (invoice.status !== "sent") continue;
    outstanding += invoice.total;
    if (isOverdue(invoice, todayIso)) {
      overdue += invoice.total;
      overdueCount++;
    }
  }
  return { outstanding, overdue, overdueCount };
}
