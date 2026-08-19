"use client";

import { useActionState } from "react";
import { createQuote } from "@/lib/actions/quotes";
import type { ActionState } from "@/lib/actions/auth";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

export function NewQuoteForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createQuote, undefined);

  return (
    <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <div>
        <label className={labelCls}>Proposal address</label>
        <input name="proposal_address" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Development description</label>
        <textarea name="development_description" rows={2} className={inputCls} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Pathway</label>
          <select name="pathway" defaultValue="CDC" className={inputCls}>
            <option value="CDC">CDC</option>
            <option value="CC">CC</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Certifier</label>
          <select name="certifier_id" defaultValue="" className={inputCls}>
            <option value="">— Select —</option>
            {certifiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Council / LGA</label>
        <input name="council_lga" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Client (optional — link an existing contact)</label>
        <select name="client_id" defaultValue="" className={inputCls}>
          <option value="">— None —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Applicant name</label>
          <input name="applicant_name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Applicant email</label>
          <input name="applicant_email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Applicant phone</label>
          <input name="applicant_phone" className={inputCls} />
        </div>
      </div>
      {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Creating…" : "Create quote"}
      </button>
    </form>
  );
}
