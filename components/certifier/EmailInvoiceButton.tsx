"use client";

import { useActionState } from "react";
import { emailInvoiceToClient, type InvoiceEmailState } from "@/lib/actions/invoices";
import { Mail } from "lucide-react";

// Sending is the moment a draft becomes an issued invoice, so the button
// carries its own feedback: who it went to, or exactly why it didn't.
export function EmailInvoiceButton({ invoiceId, again = false }: { invoiceId: string; again?: boolean }) {
  const [state, action, pending] = useActionState<InvoiceEmailState, FormData>(emailInvoiceToClient, undefined);

  return (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          disabled={pending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-success text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          <Mail size={14} /> {pending ? "Sending…" : again ? "Email again" : "Email to client"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-error max-w-56">{state.error}</span>}
      {state?.success && <span className="text-xs text-success">{state.success}</span>}
    </div>
  );
}
