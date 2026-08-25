"use client";

import { useActionState } from "react";
import { CloudUpload } from "lucide-react";
import { backUpJob } from "@/lib/actions/backup";
import type { ActionState } from "@/lib/actions/auth";

// Copies this job's files to the firm's connected cloud storage. Only the
// new ones: a file already copied up is never sent twice.
export function BackUpJobButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(backUpJob, undefined);

  return (
    <span className="inline-flex items-center gap-2">
      <form action={formAction}>
        <input type="hidden" name="job_id" value={jobId} />
        <button disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline disabled:opacity-60">
          <CloudUpload size={13} /> {pending ? "Copying to cloud…" : "Back up to cloud"}
        </button>
      </form>
      {state?.error && <span className="text-[11px] text-warning-text max-w-md">{state.error}</span>}
    </span>
  );
}
