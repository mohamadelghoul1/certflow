"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, RotateCcw } from "lucide-react";
import { displayStatus, unresolvedCount } from "@/lib/business";
import { approveItem, reopenItem } from "@/lib/actions/jobs";
import type { Amendment, ChecklistItem } from "@/types/db";

type ItemStatus = ChecklistItem["status"];

// Approving or reopening changes two things that sit in different parts of
// the item's layout — the status badge up by the title, and which button
// shows down in the action row. Sharing one optimistic value through
// context lets both flip together the instant the button is pressed,
// instead of waiting for the server to update the row, revalidate the job
// page, and stream the whole page back. If the update fails, React drops
// the optimistic value and both snap back to the real server state.
type Ctx = { status: ItemStatus; amendments: Amendment[]; approve: () => void; reopen: () => void };

const ItemStatusContext = createContext<Ctx | null>(null);

function useItemStatus() {
  const ctx = useContext(ItemStatusContext);
  if (!ctx) throw new Error("ItemStatus components must be rendered inside <ItemStatusProvider>");
  return ctx;
}

export function ItemStatusProvider({
  itemId,
  jobId,
  status,
  amendments,
  children,
}: {
  itemId: string;
  jobId: string;
  status: ItemStatus;
  amendments: Amendment[];
  children: React.ReactNode;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [, startTransition] = useTransition();

  function run(next: ItemStatus, action: (fd: FormData) => Promise<void>) {
    startTransition(async () => {
      setOptimisticStatus(next);
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      await action(fd);
    });
  }

  return (
    <ItemStatusContext.Provider
      value={{
        status: optimisticStatus,
        amendments,
        approve: () => run("approved", approveItem),
        reopen: () => run("submitted", reopenItem),
      }}
    >
      {children}
    </ItemStatusContext.Provider>
  );
}

export function ItemStatusBadge() {
  const { status, amendments } = useItemStatus();
  const { dot, label } = displayStatus({ status, amendments });

  if (dot.includes("amber")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <AlertTriangle size={12} /> {label}
      </span>
    );
  }
  if (dot.includes("emerald")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-accent">
        <CheckCircle2 size={12} /> {label}
      </span>
    );
  }
  if (dot.includes("blue")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        <Clock size={12} /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      <Circle size={12} /> {label}
    </span>
  );
}

export function ItemStatusActions() {
  const { status, amendments, approve, reopen } = useItemStatus();
  const canApprove = status === "submitted" && unresolvedCount({ status, amendments }) === 0;

  if (canApprove) {
    return (
      <button type="button" onClick={approve} className="text-sm font-medium text-white bg-accent hover:opacity-90 px-4 py-1.5 rounded-full">
        Approve
      </button>
    );
  }
  if (status === "approved") {
    return (
      <button
        type="button"
        onClick={reopen}
        className="flex items-center gap-1.5 text-sm font-medium text-muted border border-line rounded-full px-4 py-1.5 hover:bg-slate-50"
      >
        <RotateCcw size={13} /> Reopen
      </button>
    );
  }
  return null;
}
