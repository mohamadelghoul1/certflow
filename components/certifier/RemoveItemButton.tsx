"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeChecklistItem } from "@/lib/actions/jobs";

// Sits in the item's header row rather than down in the action row: taking
// a document off the checklist is a quick tidy-up, so it belongs next to
// the item it removes, not buried among the workflow actions (Approve /
// Reopen / Upload / Stamp) that get used far more often.
export function RemoveItemButton({ itemId, jobId, title }: { itemId: string; jobId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete ${title} from this checklist`}
      title="Delete from checklist"
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
      onClick={() => {
        if (!confirm(`Delete "${title}" from this checklist? This can't be undone.`)) return;
        startTransition(async () => {
          const fd = new FormData();
          fd.set("item_id", itemId);
          fd.set("job_id", jobId);
          await removeChecklistItem(fd);
        });
      }}
    >
      <X size={16} />
    </button>
  );
}
