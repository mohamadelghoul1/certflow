"use client";

import { useOptimistic, useTransition } from "react";
import { Stamp } from "lucide-react";
import { toggleStamping } from "@/lib/actions/jobs";

// Flips instantly instead of waiting on the server. As a plain form the
// button only changed once the action had updated the row, revalidated the
// job page, and streamed the whole thing back — a few seconds of looking
// broken for what is just a yes/no flag. useOptimistic shows the new state
// straight away and lets that round trip finish in the background; if it
// fails, React drops the optimistic value and the button snaps back to
// whatever the server actually holds.
export function StampToggle({ itemId, jobId, requiresStamping }: { itemId: string; jobId: string; requiresStamping: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(requiresStamping);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-full border ${
        optimistic ? "bg-warning-bg border-warning/50 text-warning-text" : "border-line text-muted hover:bg-hover"
      }`}
      onClick={() => {
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const fd = new FormData();
          fd.set("item_id", itemId);
          fd.set("job_id", jobId);
          fd.set("value", next.toString());
          await toggleStamping(fd);
        });
      }}
    >
      <Stamp size={13} /> {optimistic ? "Stamp required" : "Stamp not required"}
    </button>
  );
}
