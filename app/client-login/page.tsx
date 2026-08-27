"use client";

import { useActionState, useSyncExternalStore } from "react";
import { signInClient, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";
import { ForgotPassword } from "@/components/ForgotPassword";

export default function ClientLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInClient, undefined);
  // A one-time link that had already been used or had expired sends the
  // visitor here; saying so beats a silent sign-in page. Read from the
  // address itself — useSearchParams would force this page to render
  // per-request for the sake of one flag, and the flag never changes
  // while the page is open, so there is nothing to subscribe to.
  const expired = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("link") === "expired",
    () => false
  );

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-white">CertFlow</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-icon-300">Client portal sign in</div>
        </div>
        <form action={formAction} className="bg-white rounded-t-lg p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Email</label>
            <input name="email" type="email" required className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Password</label>
            <input name="password" type="password" required className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          {expired && !state?.error && (
            <div className="text-sm text-warning-text bg-warning-bg border border-warning/50 rounded-md px-3 py-2">
              That link had already been used or has expired. Ask for a new one below.
            </div>
          )}
          {state?.error && <div className="text-sm text-error">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-primary text-white font-semibold text-sm hover:bg-primary-700 disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="bg-white rounded-b-lg px-6 pb-5 shadow-xl">
          <ForgotPassword kind="client" />
        </div>
        <div className="text-center mt-4">
          <Link href="/login" className="text-xs text-icon-300 hover:text-white">
            Certifier? Sign in here instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
