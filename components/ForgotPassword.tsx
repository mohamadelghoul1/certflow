"use client";

import { useActionState, useState } from "react";
import { sendPasswordReset, type ResetState } from "@/lib/actions/auth";

// The "forgotten it" escape hatch, opened from either sign-in page. Kept
// on the same screen rather than a page of its own: someone who cannot
// get in does not want a journey.
export function ForgotPassword({ kind }: { kind: "certifier" | "client" }) {
  // Both sign-in pages share the dark shopfront, so the strip under each
  // is styled to match it — a white box here reads as broken.
  const linkCls = "text-xs text-slate-400 hover:text-[#f0b93a] hover:underline";
  const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl bg-[#131a26] border border-slate-700 text-white text-sm outline-none focus:border-[#f0b93a]/70 focus:ring-2 focus:ring-[#f0b93a]/25";
  const buttonCls = "px-3.5 py-2 rounded-xl bg-gradient-to-b from-[#f6c554] to-[#e8a92d] text-[#241b06] text-xs font-bold hover:opacity-95 disabled:opacity-60";
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ResetState, FormData>(sendPasswordReset, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={linkCls}>
        Forgotten your password?
      </button>
    );
  }

  return (
    <div className="pt-1">
      <form action={action} className="space-y-2">
        <input type="hidden" name="kind" value={kind} />
        <label className="block text-xs font-semibold text-slate-300">Send a reset link to</label>
        <input
          name="email"
          type="email"
          required
          placeholder="your email address"
          className={inputCls}
        />
        <div className="flex items-center gap-3">
          <button disabled={pending} className={buttonCls}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:underline">
            Cancel
          </button>
        </div>
        {state?.error && <div className="text-xs text-red-300">{state.error}</div>}
        {state?.success && <div className="text-xs text-emerald-300">{state.success}</div>}
      </form>
    </div>
  );
}
