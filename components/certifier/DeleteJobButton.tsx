"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteJob } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// Deleting a job destroys a whole project — every checklist, every
// uploaded document, the inspections and their photos, and any
// certificate already issued against it. There is no undo, so a browser
// "are you sure?" isn't enough: the certifier has to type the job's own
// address back before the button will do anything.
export function DeleteJobButton({ jobId, address }: { jobId: string; address: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteJob, undefined);

  const matches = typed.trim().toLowerCase() === (address || "").trim().toLowerCase();

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
          <div className="font-bold mb-1">This permanently deletes the whole job.</div>
          <p className="mb-2">Everything below goes with it, and none of it can be recovered:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-[13px]">
            <li>Every checklist and every document uploaded against it</li>
            <li>All inspections, their reports and photos</li>
            <li>Any CDC/CC or Occupation Certificate already issued</li>
            <li>The client&rsquo;s access to this job in the portal</li>
          </ul>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-error mb-1">
          To confirm, type the job address exactly: <span className="font-mono">{address || "(no address)"}</span>
        </label>
        <input
          name="confirm_address"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder="Type the address to confirm"
          className="w-full px-3 py-2 rounded-md border border-error/40 text-sm outline-none focus:ring-2 focus:ring-error bg-white"
        />
      </div>

      {state?.error && <div className="text-xs text-error font-medium">{state.error}</div>}

      <div className="flex items-center gap-2">
        <button
          disabled={!matches || pending}
          className="px-4 py-2 rounded-md bg-error text-white text-sm font-semibold hover:bg-error disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Deleting…" : "Delete this job permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="px-4 py-2 rounded-md text-sm text-muted hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
