"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { setPlanningPortalRef } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// The NSW Planning Portal reference, entered right where the certificate
// is issued.
//
// It goes on the certificate, so a certificate can't be issued without
// one — but it is usually the last thing to come back from the Portal,
// long after the rest of the job was filled in. Making the certifier go
// back to the Details tab for one field at the moment they are trying to
// issue is the kind of round trip that gets a job issued with a blank on
// it. Once it is recorded it collapses to a line of text with an Edit
// button, so a wrong one can still be corrected here.

export function PlanningPortalRefField({ jobId, value }: { jobId: string; value: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setPlanningPortalRef, undefined);
  const [editing, setEditing] = useState(false);
  const recorded = value.trim();

  if (recorded && !editing) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>
          NSW Planning Portal ref: <span className="font-semibold text-heading">{recorded}</span>
        </span>
        <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-secondary hover:underline">
          <Pencil size={11} /> Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex items-end gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-heading">NSW Planning Portal reference</span>
        <input
          name="planningPortalRef"
          defaultValue={recorded}
          autoFocus={editing}
          placeholder="e.g. PAN-123456"
          className="px-2 py-1.5 rounded border border-line text-xs w-56"
        />
      </label>
      <button disabled={pending} className="text-xs font-semibold text-white bg-secondary hover:opacity-90 px-3 py-1.5 rounded-md disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
      {editing && (
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:underline px-1 py-1.5">
          Cancel
        </button>
      )}
      {!recorded && !state?.error && <span className="text-xs text-muted pb-1.5">Needed before the certificate can be issued.</span>}
      {state?.error && <span className="text-xs text-error pb-1.5">{state.error}</span>}
    </form>
  );
}
