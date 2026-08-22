"use client";

import { deleteModification } from "@/lib/actions/jobs";

export function DeleteModificationButton({ jobId, modificationId, label, generated }: { jobId: string; modificationId: string; label: string; generated: boolean }) {
  return (
    <button
      className="text-xs text-error hover:underline"
      onClick={() => {
        // Spells out that the whole document checklist goes with it — the
        // checklist is the bulk of what a modification actually holds, and
        // it's cascade-deleted rather than left behind.
        const consequence = generated
          ? "This modification has already been issued. Deleting it removes it, its uploaded approval, and its whole document checklist permanently"
          : "This removes it and its whole document checklist permanently";
        if (confirm(`Delete ${label}? ${consequence} — it can't be undone.`)) {
          const fd = new FormData();
          fd.set("job_id", jobId);
          fd.set("modification_id", modificationId);
          deleteModification(fd);
        }
      }}
    >
      Delete
    </button>
  );
}
