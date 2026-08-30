"use client";

import { useActionState } from "react";
import { sendDocumentReminderNow, toggleDocumentReminders, type ReminderActionState } from "@/lib/actions/jobs";
import { BellRing, BellOff } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";

// The chasing controls, kept small because on a healthy job there is
// nothing to do here: the morning sweep reminds the client by itself.
// What a certifier needs at a glance is that it is happening (when the
// client was last reminded), a way to send one right now mid-phone-call,
// and a way to switch a particular project off.
export function DocumentReminderControls({
  jobId,
  hasClient,
  paused,
  lastRemindedAt,
}: {
  jobId: string;
  hasClient: boolean;
  paused: boolean;
  lastRemindedAt: string | null;
}) {
  const [state, sendAction, sending] = useActionState<ReminderActionState, FormData>(sendDocumentReminderNow, undefined);

  if (!hasClient) return null;

  const lastReminded = lastRemindedAt
    ? new Date(lastRemindedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted">
      {paused ? (
        <span className="inline-flex items-center gap-1.5 text-placeholder">
          <BellOff size={13} /> Document reminders paused
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <BellRing size={13} className="text-icon" />
          {lastReminded ? `Client last reminded ${lastReminded}` : "Client will be reminded automatically while documents are outstanding"}
        </span>
      )}

      {!paused && (
        <form action={sendAction}>
          <input type="hidden" name="job_id" value={jobId} />
          <button type="submit" disabled={sending} className="font-semibold text-secondary hover:underline disabled:opacity-50">
            {sending ? "Sending…" : "Send reminder now"}
          </button>
        </form>
      )}

      <form action={toggleDocumentReminders}>
        <input type="hidden" name="job_id" value={jobId} />
        <input type="hidden" name="paused" value={paused ? "false" : "true"} />
        <SubmitButton type="submit" className="text-placeholder hover:text-secondary hover:underline">
          {paused ? "Resume reminders" : "Pause for this project"}
        </SubmitButton>
      </form>

      {state?.error && <span className="text-error">{state.error}</span>}
      {state?.success && <span className="text-accent">{state.success}</span>}
    </div>
  );
}
