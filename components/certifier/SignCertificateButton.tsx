"use client";

import { useActionState } from "react";
import { PenLine } from "lucide-react";
import { signPathwayCertificate } from "@/lib/actions/jobs";
import type { ActionState } from "@/lib/actions/auth";

// Signing from the version card, so the whole issue → review → sign flow
// happens in one place instead of having to open the document page just to
// press Sign. Same action the document page uses, so signing in either
// place behaves identically.
export function SignCertificateButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signPathwayCertificate, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <button
        disabled={pending}
        className="flex items-center gap-1 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-full px-3 py-1 disabled:opacity-60"
      >
        <PenLine size={12} /> {pending ? "Signing…" : "Sign"}
      </button>
      {state?.error && <span className="text-[11px] text-red-600">{state.error}</span>}
    </form>
  );
}
