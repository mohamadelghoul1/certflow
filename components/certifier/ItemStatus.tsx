"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, EyeOff, RotateCcw, UploadCloud } from "lucide-react";
import { displayStatus, unresolvedCount } from "@/lib/business";
import { approveItem, reopenItem, certifierUploadItem, toggleStamping, toggleApprovalInclusion } from "@/lib/actions/jobs";
import { FileUpload } from "@/components/certifier/FileUpload";
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
type Ctx = {
  status: ItemStatus;
  amendments: Amendment[];
  approve: () => void;
  reopen: () => void;
  // True only while the file itself is going up. Everything after that —
  // recording it against the item and refreshing the page — happens
  // optimistically, so the card stops waiting on it.
  uploading: boolean;
  setUploading: (value: boolean) => void;
  uploadOnBehalf: (path: string) => void;
  // Whether this document belongs in the generated approval. Shared the
  // same way as the status above: the chip beside the title and the
  // button down in the action row are in different parts of the card and
  // have to flip together the moment the button is pressed.
  includedInApproval: boolean;
  toggleInclusion: () => void;
};

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
  includeInApproval,
  children,
}: {
  itemId: string;
  jobId: string;
  status: ItemStatus;
  amendments: Amendment[];
  includeInApproval: boolean;
  children: React.ReactNode;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [optimisticInclusion, setOptimisticInclusion] = useOptimistic(includeInApproval);
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  function run(next: ItemStatus, action: (fd: FormData) => Promise<void>, filePath?: string) {
    startTransition(async () => {
      setOptimisticStatus(next);
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      if (filePath) fd.set("file_path", filePath);
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
        uploading,
        setUploading,
        // Uploading on the client's behalf leaves the item awaiting
        // review, exactly as the client uploading would. Flipping to that
        // straight away means the card is done the moment the file
        // finishes going up, rather than a few seconds later once the
        // server has recorded it and streamed the whole job page back.
        uploadOnBehalf: (path: string) => run("submitted", certifierUploadItem, path),
        includedInApproval: optimisticInclusion,
        toggleInclusion: () =>
          startTransition(async () => {
            const next = !optimisticInclusion;
            setOptimisticInclusion(next);
            const fd = new FormData();
            fd.set("item_id", itemId);
            fd.set("job_id", jobId);
            fd.set("value", next.toString());
            await toggleApprovalInclusion(fd);
          }),
      }}
    >
      {children}
    </ItemStatusContext.Provider>
  );
}

// The item's card wrapper, coloured by where the document actually is:
// blue while a submitted document waits on the certifier, green once
// approved, an amber border while requested changes wait on the client.
// Reading each badge individually was the only way to tell; a whole-card
// cue makes it obvious while scanning a long checklist, and it flips
// instantly with the optimistic status like the badge and buttons do.
export function ItemCard({ children }: { children: React.ReactNode }) {
  const { status, amendments } = useItemStatus();
  const unresolved = unresolvedCount({ status, amendments });
  const tone =
    status === "approved"
      ? "border-accent/40 bg-success-bg"
      : unresolved > 0
        ? // White inside, so the amber amendment chips on the card stay visible.
          "border-warning/60 bg-white"
        : status === "submitted"
          ? "border-info/40 bg-info-bg"
          : "border-line bg-white";
  return <div className={`card-lift rounded-xl border shadow-sm p-6 ${tone}`}>{children}</div>;
}

export function ItemStatusBadge() {
  const { status, amendments, uploading } = useItemStatus();
  const { dot, label } = displayStatus({ status, amendments });

  if (uploading) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-info-bg text-info">
        <UploadCloud size={12} className="animate-pulse" /> Uploading…
      </span>
    );
  }

  if (dot.includes("amber")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-bg text-warning-text">
        <AlertTriangle size={12} /> {label}
      </span>
    );
  }
  if (dot.includes("emerald")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-success-bg text-accent">
        <CheckCircle2 size={12} /> {label}
      </span>
    );
  }
  if (dot.includes("blue")) {
    return (
      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-info-bg text-info">
        <Clock size={12} /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-surface text-muted">
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
export function ItemStatusActions({
  itemId,
  jobId,
  firmId,
  requiresStamping,
  stampPositioner,
}: {
  itemId: string;
  jobId: string;
  firmId: string;
  requiresStamping: boolean;
  // Rendered on the server (it needs the job's stamp details and a signed
  // link to the document) and passed in, so it can sit with the other
  // stamp controls rather than adrift at the end of the row.
  stampPositioner?: React.ReactNode;
}) {
  const { status, amendments, approve, reopen, setUploading, uploadOnBehalf } = useItemStatus();
  const [reviewing, setReviewing] = useState(false);
  const unresolved = unresolvedCount({ status, amendments });

  // One optimistic value for the whole stamping row. Held here rather
  // than inside StampToggle so the moment the toggle flips, "Preview
  // stamp" and "Position stamp" appear with it — gated on the
  // server-confirmed prop they trailed the toggle by the whole save
  // round trip. If the save fails, React drops the optimistic value and
  // all three fall back together.
  const [optimisticStamping, setOptimisticStamping] = useOptimistic(requiresStamping);
  const [, startStampTransition] = useTransition();
  function toggleStamp() {
    startStampTransition(async () => {
      const next = !optimisticStamping;
      setOptimisticStamping(next);
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("value", next.toString());
      await toggleStamping(fd);
    });
  }

  function stateActions() {
    // Done — the only things left are undoing it, and whether it needs stamping.
    if (status === "approved") {
      return (
        <>
          <button type="button" onClick={reopen} className="flex items-center gap-1.5 text-sm font-medium text-muted border border-line rounded-full px-4 py-1.5 hover:bg-hover">
            <RotateCcw size={13} /> Reopen
          </button>
          <StampToggle value={optimisticStamping} onToggle={toggleStamp} />
          {/* What the stamp will actually look like when the approved set
              is downloaded — the firm's name, the certificate number, and
              the certifier who signed it with their registration number. */}
          {optimisticStamping && (
            <a href={`/api/jobs/${jobId}/stamp`} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
              Preview stamp
            </a>
          )}
          {optimisticStamping && stampPositioner}
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
          <>
            {/* What happened, then what's needed — and by whom. The single
                "awaiting review" label didn't say who was holding it up,
                which is ambiguous once more than one firm is using this:
                staff couldn't tell whether the client still owed something
                or the certifier did. */}
            <span className="flex items-center gap-1.5 text-sm text-muted bg-surface border border-line rounded-full px-3 py-1.5">
              <Clock size={13} /> Client uploaded
            </span>
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-info bg-info-bg border border-info/40 rounded-full px-4 py-1.5 hover:bg-info-bg"
            >
              Awaiting certifier review
            </button>
          </>
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
            className="flex items-center gap-1.5 text-sm font-medium text-warning-text border border-warning/50 rounded-full px-4 py-1.5 hover:bg-warning-bg"
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
      return <span className="text-xs text-warning-text">Waiting on the client to address {unresolved} requested change{unresolved === 1 ? "" : "s"}.</span>;
    }
    return null;
  }

  return (
    <>
      {stateActions()}
      {/* Not ActionUpload, which awaits the server action before the page
          reacts. Here the file goes up, then the item flips to awaiting
          review immediately while the recording of it finishes in the
          background. */}
      <FileUpload
        pathPrefix={`${firmId}/${jobId}/checklist/${itemId}`}
        label="Upload on client's behalf"
        onStart={() => setUploading(true)}
        onFailed={() => setUploading(false)}
        onUploaded={(path) => {
          setUploading(false);
          uploadOnBehalf(path);
        }}
      />
    </>
  );
}

// The chip beside the document's title when it has been kept out of the
// approval, and the button in the action row that puts it back. Two
// separate places on the card, one optimistic value, so pressing the
// button changes both on the spot rather than after a round trip.
export function NotInApprovalBadge() {
  const { includedInApproval } = useItemStatus();
  if (includedInApproval) return null;
  return (
    <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-bg text-warning-text">
      <EyeOff size={12} /> Not in the approval
    </span>
  );
}

export function ApprovalInclusionToggle() {
  const { includedInApproval, toggleInclusion } = useItemStatus();
  return (
    <button
      type="button"
      onClick={toggleInclusion}
      title={
        includedInApproval
          ? "Keep this document on the checklist but leave it out of the approved set and Schedule 1"
          : "Put this document back into the approved set and Schedule 1"
      }
      className={`flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-1.5 border ${
        includedInApproval ? "border-line text-muted hover:bg-hover" : "bg-warning-bg border-warning/50 text-warning-text"
      }`}
    >
      <EyeOff size={13} /> {includedInApproval ? "In the approval" : "Not in the approval"}
    </button>
  );
}
