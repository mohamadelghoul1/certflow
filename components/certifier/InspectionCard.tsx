"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Circle } from "lucide-react";
import { setInspectionDate, recordOutcome, removeInspection } from "@/lib/actions/inspections";
import { InspectionIssues } from "@/components/certifier/InspectionIssues";
import { useInspectionList } from "@/components/certifier/InspectionOrder";
import { DateField, todayISO } from "@/components/DateField";
import type { ActionState } from "@/lib/actions/auth";
import type { Defect } from "@/types/db";

// The parts of an inspection card that change together when an outcome is
// recorded: the card turns green, the badge changes, the date fills in if
// there wasn't one, and the issues box appears for the two outcomes that
// need it.
//
// Held here as optimistic state so all of that happens on the press
// rather than after the job page has been rebuilt and streamed back —
// waiting for that was what made choosing "Satisfactory (minor issues)"
// feel like nothing had happened.

type Outcome = "pending" | "passed" | "failed" | "passed_subject_to";

export const OUTCOME_META: Record<Outcome, { label: string; style: string }> = {
  // Not an outcome, a state: the inspection hasn't happened yet. It is
  // deliberately not offered in the dropdown — you record what was found,
  // you don't set something back to un-inspected.
  pending: { label: "Not yet inspected", style: "bg-surface text-muted" },
  passed: { label: "Passed", style: "bg-success-bg text-accent" },
  failed: { label: "Failed", style: "bg-error-bg text-error" },
  passed_subject_to: { label: "Satisfactory (minor issues) subject to documents being provided", style: "bg-warning-bg text-warning-text" },
};

function OutcomeIcon({ outcome, size }: { outcome: Outcome; size: number }) {
  if (outcome === "passed") return <CheckCircle2 size={size} />;
  if (outcome === "failed") return <XCircle size={size} />;
  if (outcome === "passed_subject_to") return <AlertTriangle size={size} />;
  return <Circle size={size} />;
}

type Ctx = {
  outcome: Outcome;
  date: string;
  setOutcome: (next: Outcome) => void;
  setDate: (next: string) => void;
};

const InspectionCardContext = createContext<Ctx | null>(null);

function useCard() {
  const ctx = useContext(InspectionCardContext);
  if (!ctx) throw new Error("Inspection card pieces must be rendered inside <InspectionCardState>");
  return ctx;
}

export function InspectionCardState({
  inspectionId,
  jobId,
  outcome,
  date,
  children,
}: {
  inspectionId: string;
  jobId: string;
  outcome: Outcome;
  date: string;
  children: React.ReactNode;
}) {
  const [optimisticOutcome, setOptimisticOutcome] = useOptimistic(outcome);
  const [optimisticDate, setOptimisticDate] = useOptimistic(date);
  const [, startTransition] = useTransition();

  const fields = () => {
    const fd = new FormData();
    fd.set("inspection_id", inspectionId);
    fd.set("job_id", jobId);
    return fd;
  };

  return (
    <InspectionCardContext.Provider
      value={{
        outcome: optimisticOutcome,
        date: optimisticDate,
        setOutcome: (next) =>
          startTransition(async () => {
            setOptimisticOutcome(next);
            // The action stamps today when there is no date yet; showing
            // the same thing here keeps the two in step.
            if (next !== "pending" && !optimisticDate) setOptimisticDate(todayISO());
            const fd = fields();
            fd.set("outcome", next);
            await recordOutcome(fd);
          }),
        setDate: (next) =>
          startTransition(async () => {
            setOptimisticDate(next);
            const fd = fields();
            fd.set("date", next);
            await setInspectionDate(fd);
          }),
      }}
    >
      {children}
    </InspectionCardContext.Provider>
  );
}

// Green once the inspection has been carried out, whatever was found —
// the same whole-card cue an approved checklist item gets. The badge
// still carries the outcome itself, so a failed inspection reads as done
// without reading as fine.
export function InspectionCardShell({ children }: { children: React.ReactNode }) {
  const { outcome } = useCard();
  const done = outcome !== "pending";
  return <div className={`card-lift rounded-xl border shadow-sm p-6 ${done ? "border-accent/40 bg-success-bg" : "border-line bg-white"}`}>{children}</div>;
}

export function OutcomeBadge() {
  const { outcome } = useCard();
  const meta = OUTCOME_META[outcome];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${meta.style}`}>
      <OutcomeIcon outcome={outcome} size={12} /> {meta.label}
    </span>
  );
}

export function OutcomeSelect() {
  const { outcome, setOutcome } = useCard();
  return (
    <select
      value={outcome}
      onChange={(e) => setOutcome(e.target.value as Outcome)}
      className="w-full px-2 py-1.5 rounded border border-line text-xs bg-white"
    >
      {/* Shown only until an outcome is recorded, and never selectable:
          "not yet inspected" is where an inspection starts, not something
          you choose. */}
      {outcome === "pending" && (
        <option value="pending" disabled>
          — Select outcome —
        </option>
      )}
      <option value="passed">Passed</option>
      <option value="failed">Failed</option>
      <option value="passed_subject_to">Satisfactory (minor issues) subject to documents being provided</option>
    </select>
  );
}

function fallsOnWeekend(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

// Saves when you click away, like the rest of the card — and fills in on
// its own the moment an outcome is recorded, so a completed inspection
// always carries the date it was carried out.
export function InspectionDateBox() {
  const { date, setDate } = useCard();
  const onWeekend = !!date && fallsOnWeekend(date);

  return (
    <div className="flex-1">
      <label className="block text-[11px] text-muted mb-1">Date</label>
      <DateField
        noFuture
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full px-2 py-1.5 rounded border border-line text-xs bg-white"
      />
      {onWeekend && <div className="text-[11px] text-warning-text mt-1">⚠ falls on a weekend</div>}
    </div>
  );
}

export function IssuesWhenNeeded({ inspectionId, jobId, defects }: { inspectionId: string; jobId: string; defects: Defect[] }) {
  const { outcome } = useCard();
  if (outcome !== "failed" && outcome !== "passed_subject_to") return null;
  return <InspectionIssues inspectionId={inspectionId} jobId={jobId} defects={defects} />;
}

// Reporting an inspection to the NSW Planning Portal tells the regulator
// it was carried out. Removing it afterwards would leave CertFlow
// disagreeing with the Portal about what happened on the job, so once
// reported the button is gone and the reason is on the card.
export function RemoveInspectionButton({ inspectionId, jobId, portalReported }: { inspectionId: string; jobId: string; portalReported: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const list = useInspectionList();

  if (portalReported) {
    return <span className="ml-auto text-[11px] text-muted">Reported to the Portal — cannot be removed</span>;
  }

  const remove = () =>
    startTransition(async () => {
      setError(null);
      // Off the list straight away rather than after the job page has been
      // rebuilt and streamed back. If the removal is refused, the
      // optimistic value is dropped when this transition ends and the card
      // comes back with the reason beside it.
      list?.remove(inspectionId);
      const fd = new FormData();
      fd.set("inspection_id", inspectionId);
      fd.set("job_id", jobId);
      const result: ActionState = await removeInspection(undefined, fd);
      if (result?.error) setError(result.error);
    });

  return (
    <span className="ml-auto inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-error">{error}</span>}
      <button type="button" onClick={remove} disabled={pending} className="text-xs text-error hover:underline disabled:opacity-60">
        Remove
      </button>
    </span>
  );
}
