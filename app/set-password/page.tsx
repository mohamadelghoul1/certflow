"use client";

import { useActionState } from "react";
import { setCertifierPassword, type ActionState } from "@/lib/actions/auth";

// Where a certifier's reset link lands. Dressed like the certifier
// sign-in page it came from, rather than the client portal's.
export default function SetCertifierPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setCertifierPassword, undefined);

  return (
    <div className="min-h-screen bg-heading flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-warning">Certlyn</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-placeholder">Set a new password</div>
        </div>
        <form action={formAction} className="bg-heading border border-warning/30 rounded-lg p-6 space-y-4">
          <p className="text-sm text-placeholder">Choose a new password for your Certlyn certifier login.</p>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">New password (min. 8 characters)</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-md bg-heading border border-white/10 text-white text-sm outline-none focus:ring-2 focus:ring-warning/50"
            />
          </div>
          {state?.error && <div className="text-sm text-error">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-warning text-heading font-semibold text-sm hover:opacity-90 disabled:opacity-60">
            {pending ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
