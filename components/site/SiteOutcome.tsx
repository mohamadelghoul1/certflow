"use client";

import { createContext, useContext, useOptimistic, useTransition } from "react";
import { recordOutcome } from "@/lib/actions/inspections";

// What was found, held where the rest of the screen can see it.
//
// The outcome decides whether there is an issues section at all and what
// it is called, and that has to answer on the tap rather than after the
// server has been told and the page rebuilt. So the optimistic value
// lives here, above both, instead of inside the buttons.

type Ctx = { outcome: string; choose: (value: string) => void };
const OutcomeContext = createContext<Ctx | null>(null);

export function useSiteOutcome() {
  const ctx = useContext(OutcomeContext);
  if (!ctx) throw new Error("useSiteOutcome used outside the on-site screen");
  return ctx;
}

export function SiteOutcomeState({
  inspectionId,
  jobId,
  outcome,
  children,
}: {
  inspectionId: string;
  jobId: string;
  outcome: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useOptimistic(outcome, (_current: string, next: string) => next);
  const [, startTransition] = useTransition();

  function choose(value: string) {
    startTransition(async () => {
      setShown(value);
      const fd = new FormData();
      fd.set("inspection_id", inspectionId);
      fd.set("job_id", jobId);
      fd.set("outcome", value);
      await recordOutcome(fd);
    });
  }

  return <OutcomeContext.Provider value={{ outcome: shown, choose }}>{children}</OutcomeContext.Provider>;
}
