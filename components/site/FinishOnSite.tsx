"use client";

import { useActionState } from "react";
import { PenLine, Send, CheckCircle2 } from "lucide-react";
import { signInspectionReport, sendReport } from "@/lib/actions/inspections";
import type { ActionState } from "@/lib/actions/auth";

// The end of an inspection, in the order it actually happens: read what
// the report says, sign it, tell the regulator, and — only if it is
// wanted — tell the client.
//
// Three separate presses on purpose. Signing is the certifier putting
// their name to what was found. Reporting is the obligation to the
// regulator, which has a two-day clock on it. Emailing the client is a
// courtesy, and not every inspection is one they need an email about. A
// single button doing all three would mean a mistyped issue reaching a
// client before it could be corrected.

export function SignOnSite({
  inspectionId,
  jobId,
  outcome,
  signedAt,
  reportHref,
}: {
  inspectionId: string;
  jobId: string;
  outcome: string;
  signedAt: string | null;
  reportHref: string;
}) {
  const [signState, sign, signing] = useActionState<ActionState, FormData>(signInspectionReport, undefined);

  if (outcome === "pending") {
    return <div className="text-sm text-muted text-center py-2">Record what you found above, and the report can be signed.</div>;
  }

  return (
    <div className="space-y-3">
      <a href={reportHref} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-secondary underline py-1">
        Read the report first
      </a>

      {signedAt ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg border border-success/40 py-4 font-semibold text-success">
          <CheckCircle2 size={18} /> Signed
        </div>
      ) : (
        <form action={sign}>
          <input type="hidden" name="inspection_id" value={inspectionId} />
          <input type="hidden" name="job_id" value={jobId} />
          <button disabled={signing} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-4 font-semibold disabled:opacity-50">
            <PenLine size={18} /> {signing ? "Signing…" : "Sign the report"}
          </button>
        </form>
      )}

      {signState?.error && <div className="text-sm text-error text-center">{signState.error}</div>}
      {signedAt && <p className="text-xs text-placeholder text-center">That is the record made. The two steps below are what happens with it.</p>}
    </div>
  );
}

export function EmailReportOnSite({
  inspectionId,
  jobId,
  signedAt,
  sentAt,
}: {
  inspectionId: string;
  jobId: string;
  signedAt: string | null;
  sentAt: string | null;
}) {
  const [sendState, send, sending] = useActionState<ActionState, FormData>(sendReport, undefined);

  if (!signedAt) return <div className="text-sm text-muted text-center py-2">Sign the report above first.</div>;

  if (sentAt) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg border border-success/40 py-4 font-semibold text-success">
        <CheckCircle2 size={18} /> Emailed to the client
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form action={send}>
        <input type="hidden" name="inspection_id" value={inspectionId} />
        <input type="hidden" name="job_id" value={jobId} />
        <button disabled={sending} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success text-white py-4 font-semibold disabled:opacity-50">
          <Send size={18} /> {sending ? "Sending…" : "Email the report to the client"}
        </button>
      </form>
      {sendState?.error && <div className="text-sm text-error text-center">{sendState.error}</div>}
      <p className="text-xs text-placeholder text-center">
        Optional — their portal shows the inspection and what was found either way, but never the report itself.
      </p>
    </div>
  );
}
