import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { INVOICE_STATUS_META } from "@/lib/constants";
import { todayISO } from "@/lib/business";
import { setInvoiceStatus, deleteInvoice } from "@/lib/actions/invoices";
import { InvoiceEditForm } from "@/components/certifier/InvoiceEditForm";
import { EmailInvoiceButton } from "@/components/certifier/EmailInvoiceButton";
import { isOverdue } from "@/lib/invoices/invoiceLogic";
import type { Invoice, InvoiceLine } from "@/types/db";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile("certifier");
  const supabase = await createClient();

  const [{ data: rawInvoice }, { data: lines }, { data: clients }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).eq("firm_id", profile.firm_id).single(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("clients").select("id, name").eq("firm_id", profile.firm_id).order("name"),
  ]);
  if (!rawInvoice) notFound();
  const invoice = rawInvoice as Invoice;
  const overdue = isOverdue(invoice, todayISO());
  const meta = overdue ? { label: "Overdue", style: "bg-error-bg text-error" } : INVOICE_STATUS_META[invoice.status];
  const locked = invoice.status !== "draft";

  return (
    <div className="max-w-2xl">
      <Link href="/invoices" className="text-xs text-placeholder hover:text-primary">
        ← All invoices
      </Link>
      <div className="flex items-center justify-between mt-1 mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-primary">{invoice.reference || "Invoice"}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${meta.style}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/invoices/${id}/document`} className="px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover">
            View invoice
          </Link>
          {invoice.status === "draft" && <EmailInvoiceButton invoiceId={id} />}
          {invoice.status === "draft" && (
            <form action={setInvoiceStatus}>
              <input type="hidden" name="invoice_id" value={id} />
              <input type="hidden" name="status" value="sent" />
              <button className="px-3.5 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">Mark issued</button>
            </form>
          )}
          {invoice.status === "sent" && (
            <>
              <EmailInvoiceButton invoiceId={id} again />
              <form action={setInvoiceStatus}>
                <input type="hidden" name="invoice_id" value={id} />
                <input type="hidden" name="status" value="paid" />
                <button className="px-3.5 py-2 rounded-md border border-success/40 text-sm text-success font-medium hover:bg-success-bg">Mark as paid</button>
              </form>
              <form action={setInvoiceStatus}>
                <input type="hidden" name="invoice_id" value={id} />
                <input type="hidden" name="status" value="void" />
                <button className="px-3.5 py-2 rounded-md border border-error/40 text-sm text-error font-medium hover:bg-error-bg">Void</button>
              </form>
            </>
          )}
          {invoice.status === "paid" && (
            <form action={setInvoiceStatus}>
              <input type="hidden" name="invoice_id" value={id} />
              <input type="hidden" name="status" value="sent" />
              <button className="px-3.5 py-2 rounded-md border border-line text-sm text-muted font-medium hover:bg-hover">Undo paid</button>
            </form>
          )}
        </div>
      </div>

      {locked && invoice.status !== "void" && (
        <div className="mb-4 px-4 py-2 rounded-md bg-info-bg border border-line text-xs text-secondary">
          An issued invoice keeps its numbers exactly as sent. To correct one, void it and create a fresh invoice.
        </div>
      )}

      <InvoiceEditForm invoice={invoice} lines={(lines || []) as InvoiceLine[]} clients={clients || []} locked={locked} />

      {invoice.status === "draft" && (
        <div className="mt-8 pt-4 border-t border-line">
          <form action={deleteInvoice}>
            <input type="hidden" name="invoice_id" value={id} />
            <button className="text-sm text-error hover:underline">Delete this draft</button>
          </form>
        </div>
      )}
    </div>
  );
}
