"use client";

import { useActionState } from "react";
import { signInClient, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";

export default function ClientLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInClient, undefined);

  return (
    <div className="min-h-screen bg-teal-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-4xl font-medium text-white">CertFlow</div>
          <div className="mt-2 text-[12px] tracking-[0.2em] uppercase text-teal-300">Client portal sign in</div>
        </div>
        <form action={formAction} className="bg-white rounded-lg p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
            <input name="email" type="email" required className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
            <input name="password" type="password" required className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600" />
          </div>
          {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
          <button disabled={pending} className="w-full py-2.5 rounded-md bg-teal-800 text-white font-semibold text-sm hover:bg-teal-900 disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link href="/login" className="text-xs text-teal-300 hover:text-white">
            Certifier? Sign in here instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
