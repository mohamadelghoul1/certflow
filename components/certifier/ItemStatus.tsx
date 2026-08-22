"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, RotateCcw } from "lucide-react";
import { displayStatus, unresolvedCount } from "@/lib/business";
import { approveItem, reopenItem, certifierUploadItem } from "@/lib/actions/jobs";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { StampToggle } from "@/components/certifier/StampToggle";
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

// The item's card wrapper, tinted green once approved. Reading each badge
// individually was the only way to tell approved from not; a whole-card
// cue makes it obvious while scanning a long checklist, and it flips
// instantly with the optimistic status like the badge and buttons do.
export function ItemCard({ children }: { children: React.ReactNode }) {
  const { status } = useItemStatus();
  const approved = status === "approved";
  return (
    <div className={`card-lift rounded-xl border shadow-sm p-6 ${approved ? "border-accent/40 bg-emerald-50/40" : "border-line bg-white"}`}>{children}</div>
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

// The whole action row, driven by where the document actually is. Every
// button used to show at once regardless of state — Approve sat there
// before the client had uploaded anything, and the stamp toggle before
// there was an approved document to stamp — which made it hard to tell
// what, if anything, needed doing. Each state now offers only the actions
// that make sense for it.
//
// "Upload on client's behalf" is the exception: it sits outside the state
// branches and shows in every one of them. Stepping in for the client is
// useful at any point — they haven't uploaded, they uploaded the wrong
// file, or a corrected version turns up after approval — and scoping it
// per-state is exactly how it went missing from the review step once
// before. Uploading sets the item back to "submitted" and bumps its
// version, so a replacement always gets looked at again rather than
// silently inheriting the previous approval.
export function ItemStatusActions({ itemId, jobId, firmId, requiresStamping }: { itemId: string; jobId: string; firmId: string; requiresStamping: boolean }) {
  const { status, amendments, approve, reopen } = useItemStatus();
  const [reviewing, setReviewing] = useState(false);
  const unresolved = unresolvedCount({ status, amendments });

  function stateActions() {
    // Done — the only things left are undoing it, and whether it needs stamping.
    if (status === "approved") {
      return (
        <>
          <button type="button" onClick={reopen} className="flex items-center gap-1.5 text-sm font-medium text-muted border border-line rounded-full px-4 py-1.5 hover:bg-slate-50">
            <RotateCcw size={13} /> Reopen
          </button>
          <StampToggle itemId={itemId} jobId={jobId} requiresStamping={requiresStamping} />
          {/* What the stamp will actually look like when the approved set
              is downloaded — the firm's name, the certificate number, and
              the certifier who signed it with their registration number. */}
          {requiresStamping && (
            <a href={`/api/jobs/${jobId}/stamp`} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
              Preview stamp
            </a>
          )}
        </>
      );
    }

    // Client has uploaded and nothing is outstanding — this is the one that
    // needs a decision, so it leads with a single prompt rather than a row of
    // buttons, and only opens up to Approve / Request modification once
    // pressed. Keeps an accidental tap from approving a document outright.
    if (status === "submitted" && unresolved === 0) {
      if (!reviewing) {
        return (
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 hover:bg-blue-100"
          >
            <Clock size={13} /> Client uploaded — awaiting review
          </button>
        );
      }
      return (
        <>
          {/* Deliberately NOT green. Green means "approved" everywhere else in
              the app, so a green Approve button on an unapproved document made
              the card read as already approved. Dark = the action to take. */}
          <button type="button" onClick={approve} className="flex items-center gap-1.5 text-sm font-medium text-white bg-primary hover:opacity-90 px-4 py-1.5 rounded-full">
            <CheckCircle2 size={13} /> Approve
          </button>
          <button
            type="button"
            onClick={() => {
              setReviewing(false);
              // Requesting a change *is* adding an amendment point — the
              // mechanism already exists lower down the card, so this jumps
              // to it rather than introducing a second way to say the same
              // thing (which would then need its own resolve/track flow).
              document.getElementById(`amendment-input-${itemId}`)?.focus();
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-amber-800 border border-amber-300 rounded-full px-4 py-1.5 hover:bg-amber-50"
          >
            <AlertTriangle size={13} /> Request modification
          </button>
          <button type="button" onClick={() => setReviewing(false)} className="text-sm text-muted hover:underline px-2">
            Cancel
          </button>
        </>
      );
    }

    // Nothing uploaded yet, or changes are outstanding — the ball is with
    // the client, so there's nothing to decide here beyond the note.
    if (unresolved > 0) {
      return <span className="text-xs text-amber-700">Waiting on the client to address {unresolved} requested change{unresolved === 1 ? "" : "s"}.</span>;
    }
    return null;
  }

  return (
    <>
      {stateActions()}
      <ActionUpload action={certifierUploadItem} fields={{ item_id: itemId, job_id: jobId }} pathPrefix={`${firmId}/${jobId}/checklist/${itemId}`} label="Upload on client's behalf" />
    </>
  );
}
