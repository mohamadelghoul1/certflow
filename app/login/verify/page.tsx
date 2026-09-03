"use client";

import { useActionState } from "react";
import { verifySecondFactor, type CodeState } from "@/lib/actions/twoFactor";
import { signOut } from "@/lib/actions/auth";
import { AuthShell, AuthCard, authInputCls, authLabelCls, authButtonCls } from "@/components/AuthShell";

// The second step of signing in, for an account with an authenticator
// app set up. The password has been accepted; only the code is asked
// for here, and nothing else on the site opens until it is right.
export default function VerifyPage() {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifySecondFactor, undefined);

  return (
    <AuthShell
      kicker="Certification records"
      title="One more step."
      blurb="Open your authenticator app and enter the six-digit code it shows for Certlyn."
      footer={
        <form action={signOut}>
          <button className="text-slate-400 hover:text-[#f0b93a]">Sign out</button>
        </form>
      }
    >
      <AuthCard heading="Two-factor sign-in">
        <form action={action} className="space-y-4">
          <div>
            <label className={authLabelCls}>Six-digit code</label>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              autoFocus
              className={`${authInputCls} tracking-[0.35em] font-mono text-center text-xl`}
            />
          </div>
          {state?.error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/40 rounded-xl px-3 py-2">{state.error}</div>}
          <button disabled={pending} className={authButtonCls}>
            {pending ? "Checking…" : "Continue"}
          </button>
          <p className="text-center text-xs text-slate-400">Lost your phone? The person who runs Certlyn can remove two-factor from your account.</p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
