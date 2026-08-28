import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceTotals, invoiceNumberOf, isOverdue } from "@/lib/invoices/invoiceLogic";
import type { Invoice, InvoiceLine } from "@/types/db";

// What the client is shown about their own invoices.
//
// Invoices belong to the firm, and client RLS grants nothing on them, so
// these are read with the admin client and filtered here instead — by
// the client's own record, which is the person actually billed. Shared
// access to a project is not the same thing: it lets someone follow the
// paperwork, not see what the owner was charged.
//
// Drafts never appear (the certifier is still writing them) and neither
// do voided ones (a cancelled invoice asks for nothing, and leaving it
// on the portal only invites a payment against it).

export type PortalInvoice = {
  id: string;
  number: string;
  reference: string | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  total: number;
  status: "sent" | "paid";
  overdue: boolean;
  payUrl: string | null;
  cardSurcharge: number | null;
};

type InvoiceRow = Invoice & { invoice_lines?: Pick<InvoiceLine, "amount">[] | null };

export function portalInvoiceRows(rows: InvoiceRow[], todayIso: string): PortalInvoice[] {
  return rows
    .filter((row) => row.status === "sent" || row.status === "paid")
    .map((row) => ({
      id: row.id,
      number: invoiceNumberOf(row),
      reference: row.reference,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      paidDate: row.paid_date,
      total: invoiceTotals(row.invoice_lines || []).total,
      status: row.status as "sent" | "paid",
      overdue: isOverdue(row, todayIso),
      // Only an unpaid invoice offers a payment button: a link left live
      // beside a paid invoice is how the same fee gets paid twice.
      payUrl: row.status === "sent" ? row.stripe_payment_link_url || null : null,
      cardSurcharge: row.status === "sent" && row.card_surcharge ? Number(row.card_surcharge) : null,
    }))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
}

// Reads tolerantly: a database that hasn't run the invoicing migrations
// simply shows a portal with no invoices on it, rather than an error
// page where the client's project used to be.
export async function clientPortalInvoices(admin: SupabaseClient, clientId: string, todayIso: string, jobId?: string): Promise<PortalInvoice[]> {
  let query = admin.from("invoices").select("*, invoice_lines(amount)").eq("client_id", clientId).in("status", ["sent", "paid"]);
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error) return [];
  return portalInvoiceRows((data || []) as InvoiceRow[], todayIso);
}
