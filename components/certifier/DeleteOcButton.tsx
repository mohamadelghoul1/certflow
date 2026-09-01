"use client";

import { useActionState } from "react";
import { deleteOc } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// Deleting an issued Occupation Certificate, behind a confirm that names
// it. The server refuses once the certificate has been reported to the
// NSW Planning Portal, and the refusal is shown here rather than
// swallowed — a button that silently does nothing reads as broken.
export function DeleteOcButton({ jobId, ocId, label }: { jobId: string; ocId: string; label: string }) {
  const [state, remove, pending] = useActionState<ActionState, FormData>(async (_prev, fd) => deleteOc(_prev, fd), undefined);

  return (
    <span className="inline-flex items-center gap-2">
      <form
        action={remove}
        onSubmit={(e) => {
          if (!confirm(`Delete ${label}? This removes the certificate and its uploaded signed copy permanently — it can't be undone.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="job_id" value={jobId} />
        <input type="hidden" name="oc_id" value={ocId} />
        <button disabled={pending} className="text-xs text-error hover:underline disabled:opacity-50">
          {pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </span>
  );
}
