"use client";

import { removeChecklistItem } from "@/lib/actions/jobs";

export function RemoveItemButton({ itemId, jobId, title }: { itemId: string; jobId: string; title: string }) {
  return (
    <button
      className="text-sm font-medium px-2 py-1.5 text-red-600 hover:underline"
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
