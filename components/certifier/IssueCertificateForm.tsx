"use client";

import { useActionState } from "react";
import { issuePathwayCertificate, issueModification } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";
import type { Certifier } from "@/types/db";

const selectCls = "px-2 py-1.5 rounded border border-line text-xs";

export function IssueCertificateForm({
  jobId,
  assignedCertifierId,
  certifiers,
  isRegenerate,
}: {
  jobId: string;
  assignedCertifierId: string | null;
  certifiers: Certifier[];
  isRegenerate: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(issuePathwayCertificate, undefined);
  return (
    <form action={formAction} className="mt-3 flex items-end gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      <select name="certifier_id" defaultValue={assignedCertifierId || ""} className={selectCls}>
        <option value="">— Select certifier —</option>
        {certifiers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button disabled={pending} className="text-xs font-semibold text-white bg-success hover:bg-success px-3 py-1.5 rounded-md disabled:opacity-60">
        {pending ? "Issuing…" : isRegenerate ? "Regenerate certificate" : "Issue certificate"}
      </button>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}

export function IssueModificationForm({ jobId, modificationId, assignedCertifierId, certifiers }: { jobId: string; modificationId: string; assignedCertifierId: string | null; certifiers: Certifier[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(issueModification, undefined);
  return (
    <form action={formAction} className="mt-3 flex items-end gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="modification_id" value={modificationId} />
      <select name="certifier_id" defaultValue={assignedCertifierId || ""} className={selectCls}>
        <option value="">— Select certifier —</option>
        {certifiers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button disabled={pending} className="text-xs font-semibold text-white bg-success hover:bg-success px-3 py-1.5 rounded-md disabled:opacity-60">
        {pending ? "Issuing…" : "Issue modification"}
      </button>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  );
}
