"use client";

import { useActionState, useSyncExternalStore } from "react";
import { signInClient, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";
import { ForgotPassword } from "@/components/ForgotPassword";
import { AuthShell, AuthCard, PasswordField, authInputCls, authLabelCls, authButtonCls } from "@/components/AuthShell";

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
    <AuthShell
      kicker="Client portal"
      title="Your project, in one place."
      blurb="See where things are up to, upload what's needed, and book your inspections."
      footer={
        <Link href="/login" className="text-slate-400 hover:text-[#f0b93a]">
          Certifier? Sign in here →
        </Link>
      }
    >
      <AuthCard heading="Client portal sign in">
        <form action={formAction} className="space-y-4">
          <div>
            <label className={authLabelCls}>Email</label>
            <input name="email" type="email" required autoComplete="email" inputMode="email" autoFocus className={authInputCls} />
          </div>
          <div>
            <label className={authLabelCls}>Password</label>
            <PasswordField />
          </div>
          {expired && !state?.error && (
            <div className="text-sm text-[#f0b93a] bg-[#f0b93a]/10 border border-[#f0b93a]/40 rounded-xl px-3 py-2">
              That link had already been used or has expired. Ask for a new one below.
            </div>
          )}
          {state?.error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/40 rounded-xl px-3 py-2">{state.error}</div>}
          <button disabled={pending} className={authButtonCls}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          {pending && <p className="text-center text-xs text-slate-400">Opening your portal…</p>}
        </form>
        <div className="mt-5 pt-4 border-t border-slate-800">
          <ForgotPassword kind="client" />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
