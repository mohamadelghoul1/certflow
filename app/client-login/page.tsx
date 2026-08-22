"use client";

import { useActionState } from "react";
import { signInClient, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";

export default function ClientLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInClient, undefined);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-white">CertFlow</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-icon-300">Client portal sign in</div>
        </div>
        <form action={formAction} className="bg-white rounded-lg p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Email</label>
            <input name="email" type="email" required className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-placeholder mb-1">Password</label>
            <input name="password" type="password" required className="w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon" />
          </div>
          {state?.error && <div className="text-sm text-error">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-primary text-white font-semibold text-sm hover:bg-primary-700 disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link href="/login" className="text-xs text-icon-300 hover:text-white">
            Certifier? Sign in here instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
