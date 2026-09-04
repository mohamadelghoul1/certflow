"use client";

import { useActionState } from "react";
import { issueOc } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import type { Certifier } from "@/types/db";
import { portalRefPlaceholder, portalRefPrefix } from "@/lib/business";

export function IssueOcForm({
  jobId,
  assignedCertifierId,
  certifiers,
  needsApproval = false,
}: {
  jobId: string;
  assignedCertifierId: string | null;
  certifiers: Certifier[];
  // A team member whose director has not approved this one. They ask in
  // the panel above; the database refuses it either way (0074).
  needsApproval?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(issueOc, undefined);
  return (
    <form action={formAction} className="border border-line rounded-md p-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <div>
        <label className="block text-[11px] text-placeholder mb-1">Type</label>
        <select name="type" className="px-2 py-1.5 rounded border border-line text-xs">
          <option value="partial">Partial OC</option>
          <option value="whole">Whole OC</option>
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-[11px] text-placeholder mb-1">Scope of building works (blank uses the job&apos;s)</label>
        <input name="description" className="w-full px-2 py-1.5 rounded border border-line text-xs" />
      </div>
      {/* A partial is partial because something is unfinished, and the
          certificate must say what in its own Exclusions row. */}
      <div className="w-full">
        <label className="block text-[11px] text-placeholder mb-1">Exclusions — what this certificate does not cover (partials)</label>
        <textarea
          name="exclusions"
          rows={2}
          placeholder="e.g. This Occupation Certificate excludes the swimming pool. The swimming pool must be completed to obtain a Whole Occupation Certificate."
          className="w-full px-2 py-1.5 rounded border border-line text-xs"
        />
      </div>
      {/* Each occupation certificate is its own Portal application — a
          partial and a final OC on the same job come back with different
          numbers — so the reference is entered here, with the certificate,
          rather than taken from the job. */}
      <div>
        <label className="block text-[11px] text-placeholder mb-1">NSW Planning Portal number</label>
        <input
          name="portal_ref"
          required
          placeholder={portalRefPlaceholder("OC")}
          title={`Type the digits and the ${portalRefPrefix("OC")} prefix is added for you`}
          className="px-2 py-1.5 rounded border border-line text-xs w-40"
        />
      </div>
      <div>
        <label className="block text-[11px] text-placeholder mb-1">Certifier</label>
        <select name="certifier_id" defaultValue={assignedCertifierId || ""} className="px-2 py-1.5 rounded border border-line text-xs">
          <option value="">— Select certifier —</option>
          {certifiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button
        disabled={pending || needsApproval}
        title={needsApproval ? "A director has to approve this first" : undefined}
        className="text-xs font-semibold text-white bg-success hover:bg-success px-3 py-1.5 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Issuing…" : "Issue OC"}
      </button>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}
