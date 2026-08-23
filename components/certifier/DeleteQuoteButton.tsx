"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";

// The same confirm-by-typing pattern as DeleteJobButton: there is no
// undo, so the certifier types the quote's own proposal address back
// before the button will do anything. A project already generated from
// the quote is its own record and survives the quote's deletion.
export function DeleteQuoteButton({ quoteId, address, hasProject }: { quoteId: string; address: string; hasProject: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteQuote, undefined);

  const matches = typed.trim().toLowerCase() === (address || "").trim().toLowerCase();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-error hover:underline">
        <Trash2 size={13} /> Delete this quote
      </button>
    );
  }

  return (
    <form action={formAction} className="border border-error/40 bg-error-bg rounded-md p-4 space-y-3">
      <input type="hidden" name="quote_id" value={quoteId} />

      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
        <div className="text-sm text-error">
          <div className="font-bold mb-1">This permanently deletes the quote.</div>
          <p>
            The quote and its fee lines cannot be recovered.
            {hasProject && " The project generated from this quote is not affected — only the quote itself is removed."}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-error mb-1">
          To confirm, type the proposal address exactly: <span className="font-mono">{address || "(no address)"}</span>
        </label>
        <input
          name="confirm_address"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder="Type the address to confirm"
          className="w-full px-3 py-2 rounded-md border border-error/40 text-sm outline-none focus:ring-2 focus:ring-error bg-white"
        />
      </div>

      {state?.error && <div className="text-xs text-error font-medium">{state.error}</div>}

      <div className="flex items-center gap-2">
        <button
          disabled={!matches || pending}
          className="px-4 py-2 rounded-md bg-error text-white text-sm font-semibold hover:bg-error disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Deleting…" : "Delete this quote permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="px-4 py-2 rounded-md text-sm text-muted hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
