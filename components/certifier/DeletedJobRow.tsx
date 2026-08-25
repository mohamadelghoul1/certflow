"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { restoreJob, purgeJob } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// One deleted project, with the two things that can be done to it:
// bring it back, or destroy it for good. The permanent one carries the
// typed-address confirmation, because it is the only step in the app
// with nothing behind it.
export function DeletedJobRow({ jobId, address, description, deletedAt, deletedBy }: { jobId: string; address: string; description: string; deletedAt: string; deletedBy: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [restoreState, restoreAction, restoring] = useActionState<ActionState, FormData>(restoreJob, undefined);
  const [purgeState, purgeAction, purging] = useActionState<ActionState, FormData>(purgeJob, undefined);

  const matches = typed.trim().toLowerCase() === (address || "").trim().toLowerCase();

  return (
    <div className="px-5 py-4 border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[200px]">
          <div className="font-semibold text-sm text-primary">{address || "(no address)"}</div>
          <div className="text-xs text-placeholder">{description}</div>
          <div className="text-xs text-placeholder mt-1">
            Deleted {deletedAt}
            {deletedBy ? ` by ${deletedBy}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <form action={restoreAction}>
            <input type="hidden" name="job_id" value={jobId} />
            <button
              disabled={restoring || purging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-40"
            >
              <RotateCcw size={13} /> {restoring ? "Restoring…" : "Restore"}
            </button>
          </form>
          {!confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 text-xs font-medium text-error hover:underline">
              <Trash2 size={13} /> Delete permanently
            </button>
          )}
        </div>
      </div>

      {restoreState?.error && <div className="text-xs text-error font-medium mt-2">{restoreState.error}</div>}

      {confirming && (
        <form action={purgeAction} className="mt-3 border border-error/40 bg-error-bg rounded-md p-4 space-y-3">
          <input type="hidden" name="job_id" value={jobId} />
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
            <div className="text-sm text-error">
              <div className="font-bold mb-1">This cannot be undone.</div>
              <p className="mb-2">Everything below goes for good:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-[13px]">
                <li>Every checklist and every document uploaded against it</li>
                <li>All inspections, their reports and photos</li>
                <li>Any CDC/CC or Occupation Certificate already issued</li>
                <li>The client&rsquo;s access to this job in the portal</li>
              </ul>
              <p className="mt-2 text-[13px]">The audit log keeps a record that it was deleted, and by whom.</p>
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

          {purgeState?.error && <div className="text-xs text-error font-medium">{purgeState.error}</div>}

          <div className="flex items-center gap-2">
            <button
              disabled={!matches || purging}
              className="px-4 py-2 rounded-md bg-error text-white text-sm font-semibold hover:bg-error disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {purging ? "Deleting…" : "Delete this project permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
              className="px-4 py-2 rounded-md text-sm text-muted hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
