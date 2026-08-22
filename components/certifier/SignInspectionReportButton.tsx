"use client";

import { useActionState } from "react";
import { PenLine } from "lucide-react";
import { signInspectionReport } from "@/lib/actions/inspections";
import type { ActionState } from "@/lib/actions/auth";

// Signing from the inspection card, matching how the certificate version
// card works — so reviewing and signing are separate, deliberate steps
// rather than one button that reads as if it does both at once.
export function SignInspectionReportButton({ jobId, inspectionId }: { jobId: string; inspectionId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInspectionReport, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <button
        disabled={pending}
        className="flex items-center gap-1 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-full px-3 py-1 disabled:opacity-60"
      >
        <PenLine size={12} /> {pending ? "Signing…" : "Sign"}
      </button>
      {state?.error && <span className="text-[11px] text-error">{state.error}</span>}
    </form>
  );
}
