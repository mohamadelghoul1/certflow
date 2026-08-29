import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "@/lib/actions/invoices";
import { invoiceTotals, invoiceNumberOf, receivablesSummary, formatMoney, isOverdue } from "@/lib/invoices/invoiceLogic";
import { INVOICE_STATUS_META } from "@/lib/constants";
import { todayISO, formatISODate } from "@/lib/business";
import { financialYearStart } from "@/lib/issuanceRegister";
import { Download } from "lucide-react";
import Link from "next/link";
import type { Invoice, InvoiceLine } from "@/types/db";

// What has been billed, what is owed, and what is late — the last of
// those first, because it is the one that needs a phone call.

export async function InvoicesList({ firmId }: { firmId: string }) {
  const supabase = await createClient();

  const [{ data: invoices, error }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("firm_id", firmId).order("created_at", { ascending: false }),
    supabase.from("invoice_lines").select("invoice_id, amount"),
  ]);

  // A database still waiting on migration 0034 has no invoices table;
  // the page says so instead of erroring.
  if (error) {
    return (
      <div>
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
      <div className="flex items-center justify-end mb-6">
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

      {/* An ordinary GET form rather than a button that builds a URL in
          the browser: the period and the two Xero settings live in the
          address, so the download works the same on a phone with a
          flaky connection as on a desktop. */}
      <div className="mt-8 bg-white rounded-lg border border-line p-5">
        <div className="font-bold text-primary">Send to your accountant</div>
        <p className="text-xs text-muted mt-1 max-w-xl">
          Every issued and paid invoice in the period, as a file Xero imports directly (Business → Invoices → Import). Drafts and voided invoices are left
          out. Fees export excluding GST, which Xero adds from the tax type below.
        </p>

        <form method="get" action="/api/reports/invoices-xero" className="flex items-end gap-3 flex-wrap mt-4">
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">From</label>
            <input type="date" name="from" defaultValue={financialYearStart(today)} className="px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">To</label>
            <input type="date" name="to" defaultValue={today} className="px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Account code</label>
            <input name="account" defaultValue="200" className="w-24 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Tax type</label>
            <input name="tax" defaultValue="OUTPUT" className="w-36 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
            <Download size={15} /> Download for Xero
          </button>
        </form>

        <p className="text-[11px] text-placeholder mt-3 max-w-xl">
          The defaults are Xero&rsquo;s own Australian ones — <strong>200</strong> is Sales, <strong>OUTPUT</strong> is GST on Income. If your chart of
          accounts differs, ask your accountant once and use their codes from then on. Import one invoice first to check where it lands.
        </p>
      </div>
    </div>
  );
}
