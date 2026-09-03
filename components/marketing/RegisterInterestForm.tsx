"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { registerInterest, type InterestState } from "@/lib/actions/interest";
import { INTENTS, type Intent } from "@/lib/interest";

const inputCls =
  "w-full px-3.5 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-[15px] placeholder:text-slate-400 outline-none focus:border-[#2fa6a0] focus:ring-2 focus:ring-[#2fa6a0]/25";
const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

export function RegisterInterestForm({ defaultIntent = "demo" }: { defaultIntent?: Intent }) {
  const [state, action, pending] = useActionState<InterestState, FormData>(registerInterest, undefined);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-7">
        <div className="flex items-center gap-2 text-[17px] font-bold text-[#1f7f7a]">
          <CheckCircle2 size={20} /> {state.success}
        </div>
        <p className="mt-2 text-[15px] text-slate-600">The Certlyn team will reply, usually within a business day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-4">
      <div>
        <label className={labelCls}>I&rsquo;d like to</label>
        <select name="intent" defaultValue={defaultIntent} className={inputCls}>
          {INTENTS.map((intent) => (
            <option key={intent.value} value={intent.value}>
              {intent.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Your name</label>
          <input name="name" required maxLength={120} autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Firm</label>
          <input name="firm" required maxLength={160} autoComplete="organization" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" type="email" required maxLength={200} autoComplete="email" inputMode="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone (optional)</label>
          <input name="phone" maxLength={40} autoComplete="tel" inputMode="tel" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Anything you&rsquo;d like to tell us (optional)</label>
        <textarea name="message" rows={4} maxLength={2000} placeholder="How many certifiers, what you use now, when suits for a demo…" className={inputCls} />
      </div>
      {/* Not for people. A robot that fills every box fills this one. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state?.error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</div>}
      <button
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#f6c554] to-[#e8a92d] px-6 py-3 text-[15px] font-bold text-[#241b06] shadow-[0_6px_20px_rgba(240,185,58,0.28)] disabled:opacity-60"
      >
        <Send size={16} /> {pending ? "Sending…" : "Send"}
      </button>
      <p className="text-xs text-slate-500">
        Your details go to the Certlyn team and nowhere else — see our{" "}
        <Link href="/privacy" className="underline hover:text-slate-700">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
