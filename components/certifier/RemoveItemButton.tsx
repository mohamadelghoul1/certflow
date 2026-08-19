"use client";

import { removeChecklistItem } from "@/lib/actions/jobs";

export function RemoveItemButton({ itemId, jobId, title }: { itemId: string; jobId: string; title: string }) {
  return (
    <button
      className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200"
      onClick={() => {
        if (confirm(`Remove "${title}" from this checklist? This can't be undone.`)) {
          const fd = new FormData();
          fd.set("item_id", itemId);
          fd.set("job_id", jobId);
          removeChecklistItem(fd);
        }
      }}
    >
      Remove
    </button>
  );
}
