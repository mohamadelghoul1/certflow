"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { CheckCircle2, PenLine, Pencil } from "lucide-react";
import { formatISODate, todayISO } from "@/lib/business";
import { signInspectionReport, unsignInspectionReport } from "@/lib/actions/inspections";

// Signing from the inspection card, matching how the certificate version
// card works — so reviewing and signing are separate, deliberate steps
// rather than one button that reads as if it does both at once.
//
// Signing is not the end of it. A date typed wrong, an issue worded
// badly, a photo that should have gone in — reopening clears the
// signature and brings the Sign button back, so the corrected report is
// signed afresh rather than a signed document quietly changing under its
// own signature.
//
// Both flip on the press rather than waiting for the job page to be
// rebuilt and streamed back, the way approving a checklist item does.

type Ctx = { signedAt: string | null; error: string | null; sign: () => void; reopen: () => void };
const SigningContext = createContext<Ctx | null>(null);

export function InspectionSigning({ jobId, inspectionId, signedAt, children }: { jobId: string; inspectionId: string; signedAt: string | null; children: React.ReactNode }) {
  const [optimisticSignedAt, setOptimisticSignedAt] = useOptimistic(signedAt);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (next: string | null, action: (prev: undefined, fd: FormData) => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      setError(null);
      setOptimisticSignedAt(next);
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("inspection_id", inspectionId);
      const result = await action(undefined, fd);
      if (result?.error) setError(result.error);
    });

  return (
    <SigningContext.Provider
      value={{
        signedAt: optimisticSignedAt,
        error,
        // The server stamps the real moment; today's date is what the card
        // shows for it either way, so the two agree.
        sign: () => run(todayISO(), signInspectionReport),
        reopen: () => run(null, unsignInspectionReport),
      }}
    >
      {children}
    </SigningContext.Provider>
  );
}

export function SignInspectionReportButton() {
  const ctx = useContext(SigningContext);
  if (!ctx) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {ctx.signedAt ? (
        <>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            <CheckCircle2 size={12} /> Signed {formatISODate(ctx.signedAt)}
          </span>
          <button type="button" onClick={ctx.reopen} className="flex items-center gap-1 text-[11px] font-semibold text-secondary hover:underline">
            <Pencil size={11} /> Reopen to edit
          </button>
        </>
      ) : (
        <button type="button" onClick={ctx.sign} className="flex items-center gap-1 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-full px-3 py-1">
          <PenLine size={12} /> Sign
        </button>
      )}
      {ctx.error && <span className="text-[11px] text-error">{ctx.error}</span>}
    </span>
  );
}
