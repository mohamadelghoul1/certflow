"use client";

import { useActionState } from "react";
import { createCardPaymentLink, type InvoiceEmailState } from "@/lib/actions/invoices";
import { CreditCard, Copy } from "lucide-react";

// Creating and sharing the invoice's card-payment link. Once it exists
// the button gives way to the link itself, ready to copy into a text
// message or read over the phone.
export function CardPaymentButton({ invoiceId, existingUrl }: { invoiceId: string; existingUrl: string | null }) {
  const [state, action, pending] = useActionState<InvoiceEmailState, FormData>(createCardPaymentLink, undefined);

  if (existingUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <CreditCard size={13} className="text-icon" /> Card link ready
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(existingUrl)}
          className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline"
        >
          <Copy size={12} /> Copy
        </button>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          disabled={pending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover disabled:opacity-60"
        >
          <CreditCard size={14} /> {pending ? "Creating…" : "Add card payment"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-error max-w-56">{state.error}</span>}
      {state?.success && <span className="text-xs text-success max-w-56">{state.success}</span>}
    </div>
  );
}
