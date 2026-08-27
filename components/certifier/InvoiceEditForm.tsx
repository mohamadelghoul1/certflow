"use client";

import { useActionState } from "react";
import { updateInvoice, addInvoiceLine, removeInvoiceLine } from "@/lib/actions/invoices";
import { invoiceTotals, formatMoney } from "@/lib/invoices/invoiceLogic";
import type { ActionState } from "@/lib/actions/auth";
import type { Invoice, InvoiceLine } from "@/types/db";
import { X } from "lucide-react";

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";
const labelCls = "block text-xs font-semibold text-placeholder mb-1";

// The editable half of an invoice. Locked once it leaves draft — an
// issued tax invoice's numbers must stay exactly as issued; corrections
// are a void and a fresh invoice, as an accountant would insist.
export function InvoiceEditForm({
  invoice,
  lines,
  clients,
  locked,
}: {
  invoice: Invoice;
  lines: InvoiceLine[];
  clients: { id: string; name: string }[];
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateInvoice, undefined);
  const { subtotal, gst, total } = invoiceTotals(lines);

  return (
    <div className="space-y-5">
      <form action={formAction} className="bg-white rounded-lg border border-line p-5 space-y-4">
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Invoice number</label>
            <input name="invoice_number" defaultValue={invoice.invoice_number || ""} disabled={locked} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Client (for emailing)</label>
            <select name="client_id" defaultValue={invoice.client_id || ""} disabled={locked} className={inputCls}>
              <option value="">— none —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Issue date</label>
            <input type="date" name="issue_date" defaultValue={invoice.issue_date} disabled={locked} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input type="date" name="due_date" defaultValue={invoice.due_date || ""} disabled={locked} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bill to</label>
            <input name="bill_to" defaultValue={invoice.bill_to || ""} disabled={locked} placeholder="who the invoice is addressed to" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Reference / project</label>
            <input name="reference" defaultValue={invoice.reference || ""} disabled={locked} placeholder="usually the property address" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Payment details (printed on the invoice)</label>
            <textarea
              name="payment_details"
              rows={3}
              defaultValue={invoice.payment_details || ""}
              disabled={locked}
              placeholder="filled in from Settings when the invoice is created"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes (printed on the invoice)</label>
            <textarea name="notes" rows={2} defaultValue={invoice.notes || ""} disabled={locked} placeholder="anything else the client should read" className={inputCls} />
          </div>
        </div>
        {state?.error && <div className="text-sm text-error">{state.error}</div>}
        {!locked && (
          <button disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
            {pending ? "Saving…" : "Save invoice details"}
          </button>
        )}
      </form>

      <div className="bg-white rounded-lg border border-line p-5">
        <div className="text-sm font-bold text-primary mb-3">Fees</div>
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-2 py-2 border-b border-line text-sm">
            <div className="flex-1 text-primary">{line.description}</div>
            <div className="font-semibold text-heading">{formatMoney(Number(line.amount) || 0)}</div>
            {!locked && (
              <form action={removeInvoiceLine}>
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <input type="hidden" name="line_id" value={line.id} />
                <button className="text-placeholder hover:text-error" aria-label="Remove line">
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
        ))}
        {lines.length === 0 && <div className="py-3 text-sm text-placeholder">No fee lines yet — add the first below.</div>}

        {/* The description carries the sentence, so it gets the row; the
            amount is a number and gets number-sized. Neither uses the
            shared w-full input style, which made the two fight over the
            row and squeezed the description to a stub. */}
        {!locked && (
          <form action={addInvoiceLine} className="flex gap-2 mt-3">
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <input
              name="description"
              placeholder="e.g. CDC assessment and determination"
              className="min-w-0 flex-1 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="$ ex GST"
              className="w-28 shrink-0 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
            />
            <button className="shrink-0 px-3.5 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">Add</button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-line text-sm space-y-1">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>GST (10%)</span>
            <span>{formatMoney(gst)}</span>
          </div>
          <div className="flex justify-between font-bold text-heading text-base">
            <span>Total due</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
