"use client";

import { useActionState } from "react";
import { signInCertifier, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";

export default function CertifierLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInCertifier, undefined);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-amber-300">CertFlow</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-slate-400">Certifier sign in</div>
        </div>
        <form action={formAction} className="bg-slate-800 border border-amber-900/30 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
            <input name="email" type="email" required className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-600/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
            <input name="password" type="password" required className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-600/50" />
          </div>
          {state?.error && <div className="text-sm text-red-400">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-amber-600 text-slate-900 font-semibold text-sm hover:bg-amber-500 disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link href="/client-login" className="text-xs text-slate-500 hover:text-amber-300">
            Client? Sign in here instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
