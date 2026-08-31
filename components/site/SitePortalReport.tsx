"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { reportToPortal, reportInspectionToPortalLive } from "@/lib/actions/inspections";
import { formatISODate } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";

// Telling the NSW Planning Portal, from the site.
//
// The regulator must hear within two business days of the visit, and the
// moment a certifier is most certain of what they saw is while they are
// still standing in it. Doing it here means the whole obligation is
// finished before the van moves, instead of waiting for someone to open
// a laptop.
//
// The same two paths the desktop offers: a real submission where the
// Portal connection is configured, and marking one made by hand on the
// Portal website where it is not. Sized for a thumb, and deliberately
// after signing — the signed report is what travels with the submission.
export function SitePortalReport({
  inspectionId,
  jobId,
  live,
  defaultCaseId,
  reported,
  reportedDate,
  signed,
  submittedBy,
}: {
  inspectionId: string;
  jobId: string;
  live: boolean;
  defaultCaseId: string;
  reported: boolean;
  reportedDate: string | null;
  signed: boolean;
  submittedBy: string;
}) {
  const [caseId, setCaseId] = useState(defaultCaseId);
  const [portalEmail, setPortalEmail] = useState(submittedBy);
  const [state, send, sending] = useActionState<ActionState, FormData>(reportInspectionToPortalLive, undefined);
  const [markState, mark, marking] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, fd: FormData) => {
      await reportToPortal(fd);
      return undefined;
    },
    undefined,
  );

  if (reported) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-success-bg border border-success/40 py-4 font-semibold text-success">
        <CheckCircle2 size={18} /> Reported to the NSW Planning Portal {reportedDate ? formatISODate(reportedDate) : ""}
      </div>
    );
  }

  if (!signed) {
    return <div className="text-sm text-muted text-center py-2">Sign the report above, and it can go to the NSW Planning Portal from here.</div>;
  }

  // No API connection configured: the same fallback the desktop has —
  // recording that it was lodged by hand on the Portal website.
  if (!live) {
    return (
      <form action={mark}>
        <input type="hidden" name="inspection_id" value={inspectionId} />
        <input type="hidden" name="job_id" value={jobId} />
        <button
          disabled={marking}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary text-primary py-4 font-semibold disabled:opacity-50"
        >
          {marking ? "Saving…" : "Mark as reported to the NSW Planning Portal"}
        </button>
        <p className="text-xs text-placeholder text-center mt-2">For an inspection you lodged yourself on the Portal website.</p>
        {markState?.error && <div className="text-sm text-error text-center mt-2">{markState.error}</div>}
      </form>
    );
  }

  return (
    <form action={send} className="space-y-3">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <input type="hidden" name="job_id" value={jobId} />

      <div>
        <label className="block text-sm font-semibold text-heading mb-1">Portal case number</label>
        <input
          name="portal_case_id"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="e.g. PCA-123456"
          className="w-full px-3 py-3 rounded-lg border border-line text-base outline-none focus:ring-2 focus:ring-icon"
        />
        <p className="text-xs text-placeholder mt-1">Your Principal Certifier appointment case — the open one inspections are filed under.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-heading mb-1">Your Portal login email</label>
        <input
          name="portal_user_email"
          type="email"
          inputMode="email"
          value={portalEmail}
          onChange={(e) => setPortalEmail(e.target.value)}
          placeholder="the email you sign into the Portal with"
          className="w-full px-3 py-3 rounded-lg border border-line text-base outline-none focus:ring-2 focus:ring-icon"
        />
      </div>

      {state?.error && <div className="text-sm text-error">{state.error}</div>}

      <button
        disabled={sending || !caseId.trim() || !portalEmail.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-4 font-semibold disabled:opacity-40"
      >
        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        {sending ? "Sending…" : "Send to the NSW Planning Portal"}
      </button>
      <p className="text-xs text-placeholder text-center">The signed report goes with it — nothing to upload.</p>
    </form>
  );
}
