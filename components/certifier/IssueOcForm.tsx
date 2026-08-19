"use client";

import { useActionState } from "react";
import { issueOc } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import type { Certifier } from "@/types/db";

export function IssueOcForm({ jobId, assignedCertifierId, certifiers }: { jobId: string; assignedCertifierId: string | null; certifiers: Certifier[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(issueOc, undefined);
  return (
    <form action={formAction} className="border border-slate-200 rounded-md p-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Type</label>
        <select name="type" className="px-2 py-1.5 rounded border border-slate-200 text-xs">
          <option value="partial">Partial OC</option>
          <option value="whole">Whole OC</option>
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-[11px] text-slate-400 mb-1">Description (scope, for partials)</label>
        <input name="description" className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Certifier</label>
        <select name="certifier_id" defaultValue={assignedCertifierId || ""} className="px-2 py-1.5 rounded border border-slate-200 text-xs">
          <option value="">— Select certifier —</option>
          {certifiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button disabled={pending} className="text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-md disabled:opacity-60">
        {pending ? "Issuing…" : "Issue OC"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
