"use client";

import { useActionState } from "react";
import { PenLine, Send, CheckCircle2 } from "lucide-react";
import { signInspectionReport, sendReport } from "@/lib/actions/inspections";
import type { ActionState } from "@/lib/actions/auth";

// The last two presses: sign it, then — if you want to — tell the client.
//
// Kept apart deliberately. Signing is the certifier putting their name
// to what was found; telling the client is a separate decision, and not
// every inspection is one they need an email about. A single button
// doing both would mean a mistyped issue reaching the client before it
// could be corrected.
export function FinishOnSite({
  inspectionId,
  jobId,
  outcome,
  signedAt,
  sentAt,
  reportHref,
}: {
  inspectionId: string;
  jobId: string;
  outcome: string;
  signedAt: string | null;
  sentAt: string | null;
  reportHref: string;
}) {
  const [signState, sign, signing] = useActionState<ActionState, FormData>(signInspectionReport, undefined);
  const [sendState, send, sending] = useActionState<ActionState, FormData>(sendReport, undefined);

  if (outcome === "pending") {
    return <div className="text-sm text-muted text-center py-2">Record what you found above, and the report can be signed.</div>;
  }

  return (
    <div className="space-y-3">
      <a href={reportHref} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-secondary underline py-1">
        Read the report first
      </a>

      {!signedAt ? (
        <form action={sign}>
          <input type="hidden" name="inspection_id" value={inspectionId} />
          <input type="hidden" name="job_id" value={jobId} />
          <button disabled={signing} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-4 font-semibold disabled:opacity-50">
            <PenLine size={18} /> {signing ? "Signing…" : "Sign the report"}
          </button>
        </form>
      ) : sentAt ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg border border-success/40 py-4 font-semibold text-success">
          <CheckCircle2 size={18} /> Emailed to the client
        </div>
      ) : (
        <form action={send}>
          <input type="hidden" name="inspection_id" value={inspectionId} />
          <input type="hidden" name="job_id" value={jobId} />
          <button disabled={sending} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success text-white py-4 font-semibold disabled:opacity-50">
            <Send size={18} /> {sending ? "Sending…" : "Email the report to the client"}
          </button>
        </form>
      )}

      {signState?.error && <div className="text-sm text-error text-center">{signState.error}</div>}
      {sendState?.error && <div className="text-sm text-error text-center">{sendState.error}</div>}
      {signedAt && !sentAt && (
        <p className="text-xs text-placeholder text-center">
          Signed, and that is the record made. Emailing it to the client is optional — their portal shows the inspection and what was found either
          way, but never the report itself.
        </p>
      )}
    </div>
  );
}
