"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteJob } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// Deleting a project takes it out of the jobs list, the dashboard, the
// reports and the client's portal — but nothing is thrown away yet. The
// row, its documents, its inspections and any certificate already issued
// against it all stay where they are for thirty days, and the whole
// project can be brought back from Projects → Deleted. After that the
// morning sweep removes it for good (lib/deletedJobsPurge).
//
// That is why this is two clicks rather than the typed-address
// confirmation it used to be: the confirmation now sits on the permanent
// delete, which is the step that really cannot be undone.
export function DeleteJobButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteJob, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-error hover:underline">
        <Trash2 size={13} /> Delete this job
      </button>
    );
  }

  return (
    <form action={formAction} className="border border-error/40 bg-error-bg rounded-md p-4 space-y-3">
      <input type="hidden" name="job_id" value={jobId} />

      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
        <div className="text-sm text-error">
          <div className="font-bold mb-1">Delete this project?</div>
          <p>
            It disappears from your projects, your dashboard, your reports and the client&rsquo;s portal. Nothing is thrown away — you can bring it back at any time from{" "}
            <span className="font-semibold">Projects &rarr; Deleted</span>.
          </p>
        </div>
      </div>

      {state?.error && <div className="text-xs text-error font-medium">{state.error}</div>}

      <div className="flex items-center gap-2">
        <button disabled={pending} className="px-4 py-2 rounded-md bg-error text-white text-sm font-semibold hover:bg-error disabled:opacity-40 disabled:cursor-not-allowed">
          {pending ? "Deleting…" : "Delete this project"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-sm text-muted hover:bg-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
