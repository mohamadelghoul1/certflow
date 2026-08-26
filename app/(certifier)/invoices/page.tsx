import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "@/lib/actions/invoices";
import { invoiceTotals, invoiceNumberOf, receivablesSummary, formatMoney, isOverdue } from "@/lib/invoices/invoiceLogic";
import { INVOICE_STATUS_META } from "@/lib/constants";
import { todayISO, formatISODate } from "@/lib/business";
import Link from "next/link";
import type { Invoice, InvoiceLine } from "@/types/db";

// The money page: what has been billed, what is owed, and what is late —
// the last of those first, because it is the one that needs a phone call.
export default async function InvoicesPage() {
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: invoices, error }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("firm_id", profile.firm_id).order("created_at", { ascending: false }),
    supabase.from("invoice_lines").select("invoice_id, amount"),
  ]);

  // A database still waiting on migration 0034 has no invoices table;
  // the page says so instead of erroring.
  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold text-primary mb-4">Invoices</h1>
        <div className="px-4 py-3 rounded-md bg-warning-bg border border-warning/50 text-sm text-warning-text">
          Invoicing needs database update 0034 — run it in Supabase, then reload this page. Settings → System check shows what&rsquo;s been run.
        </div>
      </div>
    );
  }

  const linesByInvoice = new Map<string, { amount: number }[]>();
  for (const line of (lines || []) as Pick<InvoiceLine, "invoice_id" | "amount">[]) {
    const group = linesByInvoice.get(line.invoice_id) || [];
    group.push({ amount: line.amount });
    linesByInvoice.set(line.invoice_id, group);
  }

  const today = todayISO();
  const withTotals = ((invoices || []) as Invoice[]).map((invoice) => ({
    ...invoice,
    total: invoiceTotals(linesByInvoice.get(invoice.id) || []).total,
  }));
  const summary = receivablesSummary(withTotals, today);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-primary">Invoices</h1>
        <form action={createInvoice}>
          <button className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">+ New invoice</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-2xl font-bold text-heading">{formatMoney(summary.outstanding)}</div>
          <div className="text-xs font-medium text-muted mt-1">Owed to you (incl. GST)</div>
        </div>
        <div className={`rounded-xl border bg-white p-4 ${summary.overdueCount > 0 ? "border-error/40" : "border-line"}`}>
          <div className={`text-2xl font-bold ${summary.overdueCount > 0 ? "text-error" : "text-heading"}`}>{formatMoney(summary.overdue)}</div>
          <div className="text-xs font-medium text-muted mt-1">
            Overdue{summary.overdueCount > 0 ? ` — ${summary.overdueCount} invoice${summary.overdueCount === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-heading">{withTotals.filter((i) => i.status === "paid").length}</div>
          <div className="text-xs font-medium text-muted mt-1">Paid invoices</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-line overflow-hidden">
        {withTotals.map((invoice) => {
          const overdue = isOverdue(invoice, today);
          const meta = overdue ? { label: "Overdue", style: "bg-error-bg text-error" } : INVOICE_STATUS_META[invoice.status];
          return (
            <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line last:border-b-0 hover:bg-hover">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-primary truncate">
                  {invoiceNumberOf(invoice)}
                  {invoice.reference ? ` — ${invoice.reference}` : ""}
                </div>
                <div className="text-xs text-placeholder">
                  Issued {formatISODate(invoice.issue_date)}
                  {invoice.due_date ? ` · due ${formatISODate(invoice.due_date)}` : ""}
                  {invoice.status === "paid" && invoice.paid_date ? ` · paid ${formatISODate(invoice.paid_date)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-heading">{formatMoney(invoice.total)}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
              </div>
            </Link>
          );
        })}
        {withTotals.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-placeholder">
            No invoices yet. Create one here, or from an accepted quote&rsquo;s page.
          </div>
        )}
      </div>
    </div>
  );
}
