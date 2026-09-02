"use client";

import { useActionState, useState } from "react";
import { ListChecks, Sparkles } from "lucide-react";
import { saveOutstandingSummary, sendOutstandingSummary, writeOutstandingSummary, type SummaryState } from "@/lib/actions/outstandingSummary";
import { SaveButton } from "@/components/certifier/SaveButton";
import type { NotifyState } from "@/lib/actions/jobs";
import type { OutstandingStage, OutstandingState } from "@/lib/outstandingDocuments";
import type { JobDetails } from "@/types/db";

// What the project is still waiting on, and the note to the client
// about it.
//
// The list is the app's own reading of the checklists and cannot be
// argued with here — a document is added or approved on its own tab.
// Underneath it sits the note: written by the AI when there is a key
// for it, from the library's descriptions when there is not, and then
// the certifier's to change before it goes anywhere. Nothing is sent
// without the Send button being pressed.

const STATE_STYLE: Record<OutstandingState, { label: string; className: string }> = {
  not_received: { label: "Not received", className: "bg-slate-100 text-slate-600" },
  needs_changes: { label: "Needs changes", className: "bg-warning-bg text-warning-text" },
  with_certifier: { label: "With you to review", className: "bg-info-bg text-secondary" },
};

type Summary = NonNullable<JobDetails["outstandingSummary"]>;

export function OutstandingDocumentsPanel({
  jobId,
  stages,
  summary,
  aiConfigured,
  hasClient,
}: {
  jobId: string;
  stages: OutstandingStage[];
  summary: Summary | null;
  aiConfigured: boolean;
  hasClient: boolean;
}) {
  const [writeState, write, writing] = useActionState<SummaryState, FormData>(writeOutstandingSummary, undefined);
  const [saveState, save, saving] = useActionState<SummaryState, FormData>(saveOutstandingSummary, undefined);
  const [sendState, send, sending] = useActionState<NotifyState, FormData>(sendOutstandingSummary, undefined);
  const [text, setText] = useState(summary?.text || "");

  const total = stages.reduce((sum, s) => sum + s.items.length, 0);
  const clientTotal = stages.reduce((sum, s) => sum + s.items.filter((i) => !i.internal && i.state !== "with_certifier").length, 0);

  const writtenBy = summary?.written === "ai" ? "Written by AI" : summary?.written === "edited" ? "Edited by you" : "Standard wording";
  const generated = summary?.generatedAt
    ? new Date(summary.generatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <details className="border border-line rounded-xl bg-white shadow-sm mb-6 group" open={total > 0 && !!summary}>
      <summary className="flex items-center gap-2 px-6 py-4 cursor-pointer select-none list-none">
        <ListChecks size={16} className="text-icon" />
        <span className="text-base font-semibold text-heading">What&rsquo;s still needed</span>
        {total === 0 ? (
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-bg text-accent">Nothing outstanding</span>
        ) : (
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning-bg text-warning-text">
            {total} document{total === 1 ? "" : "s"}
          </span>
        )}
        <span className="ml-auto text-xs text-placeholder group-open:hidden">Show</span>
        <span className="ml-auto text-xs text-placeholder hidden group-open:inline">Hide</span>
      </summary>

      <div className="px-6 pb-6 space-y-5">
        {total === 0 ? (
          <p className="text-sm text-muted">Every document requested on this project has been approved.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {stages.map((stage) => (
              <div key={stage.key}>
                <div className="text-xs font-semibold text-heading mb-1.5">{stage.label}</div>
                <ul className="space-y-1">
                  {stage.items.map((item, i) => (
                    <li key={`${stage.key}-${i}`} className="flex items-start justify-between gap-2 text-sm text-heading leading-snug">
                      <span>
                        {item.title}
                        {item.internal && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-placeholder">internal</span>}
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATE_STYLE[item.state].className}`}>
                        {STATE_STYLE[item.state].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {clientTotal > 0 && (
          <div className="pt-4 border-t border-line">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <div className="text-sm font-semibold text-heading">Note to the client</div>
              <form action={write}>
                <input type="hidden" name="job_id" value={jobId} />
                <button
                  type="submit"
                  disabled={writing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
                >
                  <Sparkles size={13} />
                  {writing ? "Writing…" : summary ? (aiConfigured ? "Rewrite with AI" : "Rewrite") : aiConfigured ? "Write with AI" : "Write the note"}
                </button>
              </form>
            </div>
            <p className="text-xs text-muted mb-3">
              {aiConfigured
                ? "The AI explains each outstanding document in plain English — what it is, who prepares it, what it must show. It only describes the documents listed above; it never adds or removes one. Read it over, change anything you like, then send."
                : "Written from your document library's descriptions. To have the AI explain each document in plain English, add ANTHROPIC_API_KEY under Vercel → Settings → Environment Variables."}
            </p>
            {writeState?.error && <p className="text-xs text-error mb-2">{writeState.error}</p>}
            {writeState?.notice && <p className="text-xs text-warning-text mb-2">{writeState.notice}</p>}

            {summary && (
              <>
                <form action={save}>
                  <input type="hidden" name="job_id" value={jobId} />
                  <textarea
                    name="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={Math.min(18, Math.max(6, text.split("\n").length + 1))}
                    className="w-full px-3 py-2 rounded-md border border-line text-sm leading-relaxed outline-none focus:ring-2 focus:ring-icon font-[inherit]"
                  />
                  <div className="flex items-center gap-3 flex-wrap mt-2">
                    <SaveButton pending={saving} savedAt={saveState?.savedAt} className="px-3.5 py-1.5 rounded-md border border-line text-xs font-semibold text-heading hover:bg-slate-50 disabled:opacity-60">
                      Save changes
                    </SaveButton>
                    <span className="text-[11px] text-placeholder">
                      {writtenBy}
                      {generated ? ` · ${generated}` : ""}
                    </span>
                    {saveState?.error && <span className="text-xs text-error">{saveState.error}</span>}
                  </div>
                </form>

                <form action={send} className="mt-3">
                  <input type="hidden" name="job_id" value={jobId} />
                  <input type="hidden" name="text" value={text} />
                  <button
                    type="submit"
                    disabled={sending || !hasClient || !text.trim()}
                    className="text-xs font-semibold text-secondary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {sending ? "Sending…" : sendState?.success ? "Send to the client again" : "Send to the client by email"}
                  </button>
                  {!hasClient && <span className="ml-2 text-[11px] text-placeholder">Add a client on the Details tab to send it.</span>}
                  {!sending && sendState?.success && <div className="text-[11px] text-success mt-0.5">✓ {sendState.success}</div>}
                  {!sending && sendState?.error && <div className="text-[11px] text-error mt-0.5">{sendState.error}</div>}
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
