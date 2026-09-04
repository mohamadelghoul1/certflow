"use client";

import { useActionState, useState } from "react";
import { ShieldCheck, Clock, ThumbsDown } from "lucide-react";
import { requestIssueApproval, decideIssueApproval } from "@/lib/actions/issueApprovals";
import { formatISODate } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";
import type { ApprovalState, IssueStage } from "@/lib/issueApprovals";

const noteCls = "w-full px-2 py-1.5 rounded border border-line text-xs outline-none focus:ring-2 focus:ring-icon";

function whenText(iso: string | null): string {
  if (!iso) return "";
  return formatISODate(iso.slice(0, 10));
}

// The sign-off, shown beside the Issue button.
//
// A team member sees where their request is up to and, when there isn't
// one, the button to ask. A director sees the request itself with
// Approve and Decline. Nothing here issues anything — an approval lets
// the person who asked press Issue once.
export function IssueApprovalPanel({
  jobId,
  stage,
  what,
  approval,
  director,
  nameOf,
}: {
  jobId: string;
  stage: IssueStage;
  // "CDC", "CC" or "Occupation Certificate" — what is being issued.
  what: string;
  approval: ApprovalState;
  director: boolean;
  // Certifier id → name, for saying who asked and who decided.
  nameOf: Record<string, string>;
}) {
  const [asking, setAsking] = useState(false);
  const [requestState, requestAction, requestPending] = useActionState<ActionState, FormData>(requestIssueApproval, undefined);
  const [decideState, decideAction, decidePending] = useActionState<ActionState, FormData>(decideIssueApproval, undefined);

  if (approval.state === "not-needed") return null;

  const asked = approval.state === "none" ? null : approval.row;
  const askedBy = asked?.requested_by ? nameOf[asked.requested_by] || "A team member" : "A team member";

  // A director looking at a pending request: decide it here.
  if (director) {
    if (approval.state !== "pending") return null;
    return (
      <div className="mt-3 rounded-lg border border-warning/50 bg-warning-bg p-4">
        <div className="text-sm font-semibold text-warning-text">
          {askedBy} is asking to issue this {what}.
        </div>
        <div className="text-xs text-warning-text/80 mt-0.5">Requested {whenText(asked!.requested_at)}</div>
        {asked!.request_note && <p className="mt-2 text-xs text-warning-text whitespace-pre-wrap">{asked!.request_note}</p>}
        <form action={decideAction} className="mt-3 space-y-2">
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="approval_id" value={asked!.id} />
          <input name="note" placeholder="A note back (optional)" className={noteCls} />
          <div className="flex gap-2">
            <button
              name="decision"
              value="approve"
              disabled={decidePending}
              className="text-xs font-semibold text-white bg-success px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60"
            >
              {decidePending ? "Saving…" : "Approve issuing"}
            </button>
            <button name="decision" value="decline" disabled={decidePending} className="text-xs font-semibold text-error px-3 py-1.5 rounded-md hover:bg-white">
              Decline
            </button>
          </div>
          <p className="text-[11px] text-warning-text/80">
            Approving does not issue anything — it lets {askedBy} press Issue once. A later regeneration asks again.
          </p>
          {decideState?.error && <div className="text-xs text-error">{decideState.error}</div>}
        </form>
      </div>
    );
  }

  if (approval.state === "approved") {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/40 bg-success-bg px-4 py-3 text-xs text-accent">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">Approved to issue</span> by {asked!.decided_by ? nameOf[asked!.decided_by] || "a director" : "a director"}
          {asked!.decided_at ? ` on ${whenText(asked!.decided_at)}` : ""}. This covers one issue — regenerating later asks again.
          {asked!.decision_note && <span className="block mt-1 whitespace-pre-wrap">{asked!.decision_note}</span>}
        </span>
      </div>
    );
  }

  if (approval.state === "pending") {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning-bg px-4 py-3 text-xs text-warning-text">
        <Clock size={15} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">Waiting on a director.</span> Asked {whenText(asked!.requested_at)}. Your directors have been emailed and it is
          on their dashboard.
        </span>
      </div>
    );
  }

  // No live request: declined once, or never asked.
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-4">
      {approval.state === "declined" && (
        <div className="mb-2 flex items-start gap-2 text-xs text-error">
          <ThumbsDown size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Not approved</span>
            {asked!.decided_by ? ` by ${nameOf[asked!.decided_by] || "a director"}` : ""}
            {asked!.decided_at ? ` on ${whenText(asked!.decided_at)}` : ""}.
            {asked!.decision_note && <span className="block mt-1 whitespace-pre-wrap">{asked!.decision_note}</span>}
          </span>
        </div>
      )}
      <div className="text-xs text-muted">
        A director has to approve before you can issue this {what}.
      </div>
      {asking ? (
        <form action={requestAction} className="mt-2 space-y-2">
          <input type="hidden" name="job_id" value={jobId} />
          <input type="hidden" name="stage" value={stage} />
          <input name="note" placeholder="Anything the director should know (optional)" className={noteCls} autoFocus />
          <div className="flex gap-2">
            <button disabled={requestPending} className="text-xs font-semibold text-white bg-primary px-3 py-1.5 rounded-md hover:bg-primary-700 disabled:opacity-60">
              {requestPending ? "Sending…" : "Send the request"}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="text-xs text-muted hover:bg-hover px-3 py-1.5 rounded-md">
              Cancel
            </button>
          </div>
          {requestState?.error && <div className="text-xs text-error">{requestState.error}</div>}
        </form>
      ) : (
        <button onClick={() => setAsking(true)} className="mt-2 text-xs font-semibold text-white bg-primary px-3 py-1.5 rounded-md hover:bg-primary-700">
          {approval.state === "declined" ? "Ask again" : "Request director approval"}
        </button>
      )}
    </div>
  );
}
