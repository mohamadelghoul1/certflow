"use client";

import { useActionState } from "react";
import { setPasswordAndAcceptInvite, type ActionState } from "@/lib/actions/auth";

// Deliberately outside the (app) route group: the portal layout demands a
// finished client profile, but the person arriving here from an invite
// link doesn't have one yet — submitting this form is what creates it.
export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setPasswordAndAcceptInvite, undefined);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-white">CertFlow</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-icon-300">Welcome — set your password</div>
        </div>
        <form action={formAction} className="bg-white rounded-lg p-6 space-y-4 shadow-xl">
          <p className="text-sm text-muted">Choose a password for your CertFlow client portal login.</p>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">New password (min. 8 characters)</label>
            <input name="password" type="password" required minLength={8} className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          {state?.error && <div className="text-sm text-error">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-primary text-white font-semibold text-sm hover:bg-primary-700 disabled:opacity-60">
            {pending ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
