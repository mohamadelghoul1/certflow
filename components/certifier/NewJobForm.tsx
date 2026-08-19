"use client";

import { useActionState, useState } from "react";
import { createJob } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import { JOB_TYPES } from "@/lib/constants";

const inputCls = "w-full px-3 py-2 rounded-md border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-600";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

export function NewJobForm({ certifiers, clients }: { certifiers: { id: string; name: string }[]; clients: { id: string; name: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createJob, undefined);
  const [types, setTypes] = useState<Set<string>>(new Set());

  return (
    <form action={formAction} className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
      <div>
        <label className={labelCls}>Site address</label>
        <input name="address" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Scope of works</label>
        <textarea name="description" rows={2} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Job type(s)</label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map((t) => (
            <label key={t} className={`px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer ${types.has(t) ? "bg-teal-800 text-white border-teal-800" : "border-slate-200 text-slate-600"}`}>
              <input
                type="checkbox"
                name="job_types"
                value={t}
                className="hidden"
                onChange={(e) => {
                  setTypes((prev) => {
                    const next = new Set(prev);
                    e.target.checked ? next.add(t) : next.delete(t);
                    return next;
                  });
                }}
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Pathway</label>
          <select name="pathway" className={inputCls} defaultValue="CDC">
            <option value="CDC">CDC</option>
            <option value="CC">CC</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Assigned certifier</label>
          <select name="assigned_certifier_id" className={inputCls} defaultValue="">
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
        <label className={labelCls}>Client (portal access)</label>
        <select name="client_id" className={inputCls} defaultValue="">
          <option value="">— None yet —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </div>
      {state?.error && <div className="text-sm text-red-600">{state.error}</div>}
      <button disabled={pending} className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 disabled:opacity-60">
        {pending ? "Creating…" : "Create job"}
      </button>
    </form>
  );
}
