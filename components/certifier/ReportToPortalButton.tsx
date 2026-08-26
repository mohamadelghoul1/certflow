"use client";

import { useActionState, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { reportToPortal, reportInspectionToPortalLive, unreportFromPortal } from "@/lib/actions/inspections";
import { formatISODate } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";

// Reporting an inspection to the NSW Planning Portal.
//
// With the Portal connection configured, the button opens a small
// confirmation panel — what will be sent, and against which Portal case —
// and one press sends it: CertFlow makes the API calls and attaches the
// signed report itself, so there is nothing to upload. Without the
// connection, the button falls back to what it always did: marking an
// inspection the certifier reported by hand on the Portal website.
export function ReportToPortalButton({
  inspectionId,
  jobId,
  live,
  defaultCaseId,
  reported,
  reportedDate,
  sentByApi,
  summary,
}: {
  inspectionId: string;
  jobId: string;
  // Whether the Portal API connection is configured in Vercel.
  live: boolean;
  // The job's Planning Portal reference, offered as the case number.
  defaultCaseId: string;
  reported: boolean;
  reportedDate: string | null;
  // True when the Portal's own case number is on record — an API send.
  sentByApi: boolean;
  // What the panel shows is about to go: type, date, outcome.
  summary: { title: string; date: string; outcome: string; signed: boolean; submittedBy: string };
}) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(defaultCaseId);
  const [portalEmail, setPortalEmail] = useState(summary.submittedBy);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reportInspectionToPortalLive, undefined);
  const [undoState, undoAction, undoing] = useActionState<ActionState, FormData>(unreportFromPortal, undefined);

  if (reported) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-placeholder">
        Reported to Portal {formatISODate(reportedDate)}
        {/* A mark made by hand can be undone; a real API submission cannot. */}
        {!sentByApi && live && (
          <form action={undoAction} className="inline-flex items-center gap-2">
            <input type="hidden" name="inspection_id" value={inspectionId} />
            <input type="hidden" name="job_id" value={jobId} />
            <button disabled={undoing} className="text-[11px] text-placeholder hover:text-muted hover:underline disabled:opacity-50">
              {undoing ? "Undoing…" : "Undo"}
            </button>
            {undoState?.error && <span className="text-[11px] text-error">{undoState.error}</span>}
          </form>
        )}
      </span>
    );
  }

  // No API connection: the old behaviour, marking a hand-made report.
  if (!live) {
    return (
      <form action={reportToPortal}>
        <input type="hidden" name="inspection_id" value={inspectionId} />
        <input type="hidden" name="job_id" value={jobId} />
        <button className="text-xs font-semibold text-muted hover:underline">Mark as reported to Portal</button>
      </form>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          // Pulled fresh on every open, not once when the page loaded —
          // a case or email recorded on the Details tab or in Settings a
          // moment ago must show up here without a page refresh.
          setCaseId(defaultCaseId);
          setPortalEmail(summary.submittedBy);
          setOpen(true);
        }}
        className="text-xs font-semibold text-secondary hover:underline"
      >
        Report to NSW Planning Portal
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full mt-2 border border-line bg-white rounded-md p-4 space-y-3">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <input type="hidden" name="job_id" value={jobId} />

      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-primary">Report this inspection to the NSW Planning Portal</div>
        <button type="button" onClick={() => setOpen(false)} className="text-placeholder hover:text-muted">
          <X size={15} />
        </button>
      </div>

      <div className="text-xs text-muted space-y-0.5">
        <div>
          <span className="text-placeholder">Inspection:</span> {summary.title} — {summary.date}
        </div>
        <div>
          <span className="text-placeholder">Result:</span> {summary.outcome}
        </div>
        <div>
          <span className="text-placeholder">Attached:</span>{" "}
          {summary.signed ? "the signed inspection report (sent automatically — nothing to upload)" : "nothing yet — sign the report first"}
        </div>

      </div>

      <div>
        <label className="block text-xs font-semibold text-placeholder mb-1">Your NSW Planning Portal login email</label>
        <input
          name="portal_user_email"
          type="email"
          value={portalEmail}
          onChange={(e) => setPortalEmail(e.target.value)}
          placeholder="the email you sign into the Portal website with"
          className="w-full sm:w-80 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
        />
        <p className="text-[11px] text-placeholder mt-1">
          The Portal records the submission against this account, so it must be the exact email of your Portal login — not necessarily your CertFlow one.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-placeholder mb-1">Portal case number this inspection belongs to</label>
        <input
          name="portal_case_id"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="e.g. PCA-123456"
          className="w-full sm:w-80 px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon"
        />
        <p className="text-[11px] text-placeholder mt-1">
          Usually your Principal Certifier appointment (PCA) case — that is the open case inspections are filed under. A determined CDC/CC case is closed and cannot take them.
        </p>
      </div>

      {state?.error && <div className="text-xs text-error font-medium">{state.error}</div>}

      <div className="flex items-center gap-2">
        <button
          disabled={pending || !caseId.trim() || !portalEmail.trim() || !summary.signed}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-40"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {pending ? "Sending to the Portal…" : "Send to the Portal"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm text-muted hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}
