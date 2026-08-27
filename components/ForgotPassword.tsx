"use client";

import { useActionState, useState } from "react";
import { sendPasswordReset, type ResetState } from "@/lib/actions/auth";

// The "forgotten it" escape hatch, opened from either sign-in page. Kept
// on the same screen rather than a page of its own: someone who cannot
// get in does not want a journey.
export function ForgotPassword({ kind }: { kind: "certifier" | "client" }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ResetState, FormData>(sendPasswordReset, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-placeholder hover:text-primary hover:underline">
        Forgotten your password?
      </button>
    );
  }

  return (
    <div className="pt-3 border-t border-line">
      <form action={action} className="space-y-2">
        <input type="hidden" name="kind" value={kind} />
        <label className="block text-xs font-semibold text-placeholder">Send a reset link to</label>
        <input
          name="email"
          type="email"
          required
          placeholder="your email address"
          className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
        />
        <div className="flex items-center gap-3">
          <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-placeholder hover:underline">
            Cancel
          </button>
        </div>
        {state?.error && <div className="text-xs text-error">{state.error}</div>}
        {state?.success && <div className="text-xs text-success">{state.success}</div>}
      </form>
    </div>
  );
}
