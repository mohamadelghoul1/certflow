"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { registerInterest, type InterestState } from "@/lib/actions/interest";

const inputCls =
  "w-full px-3.5 py-3 rounded-xl bg-[#131a26] border border-slate-700 text-white text-[15px] placeholder:text-slate-500 outline-none focus:border-[#f0b93a]/70 focus:ring-2 focus:ring-[#f0b93a]/25";
const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5";

export function RegisterInterestForm() {
  const [state, action, pending] = useActionState<InterestState, FormData>(registerInterest, undefined);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-[#f0b93a]/40 bg-[#f0b93a]/10 p-7">
        <div className="flex items-center gap-2 text-[17px] font-bold text-[#f0b93a]">
          <CheckCircle2 size={20} /> {state.success}
        </div>
        <p className="mt-2 text-[15px] text-slate-300">We&rsquo;ll reply from a real person, usually within a business day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-slate-700/80 bg-[#0e1520]/85 p-7 space-y-4">
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
        <textarea name="message" rows={4} maxLength={2000} placeholder="How many certifiers, what you use now, what you'd want first…" className={inputCls} />
      </div>
      {/* Not for people. A robot that fills every box fills this one. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state?.error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/40 rounded-xl px-3 py-2">{state.error}</div>}
      <button
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#f6c554] to-[#e8a92d] px-6 py-3 text-[15px] font-bold text-[#241b06] disabled:opacity-60"
      >
        <Send size={16} /> {pending ? "Sending…" : "Register your interest"}
      </button>
      <p className="text-xs text-slate-500">Your details go to the team behind Certlyn and nowhere else.</p>
    </form>
  );
}
