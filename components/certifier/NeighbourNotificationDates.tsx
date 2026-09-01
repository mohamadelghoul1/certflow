"use client";

import { useActionState, useState } from "react";
import { setNeighbourNotificationDates } from "@/lib/actions/jobs";
import { notificationEndDate, notificationFirstDay } from "@/lib/neighbourNotification";
import { SaveButton } from "@/components/certifier/SaveButton";
import type { ActionState } from "@/lib/actions/auth";

// When the neighbour notice went out, and when its 17 days are up.
//
// The end date fills itself in from the start date — seventeen days, with
// a notice that goes out on a Friday counted from the following Tuesday,
// because it sits in letterboxes over the weekend. The certifier can
// still type over it: the rule serves the ordinary case, it does not
// argue with the person applying it.
export function NeighbourNotificationDates({ jobId, start, end }: { jobId: string; start: string; end: string }) {
  const [state, save, pending] = useActionState<ActionState, FormData>(setNeighbourNotificationDates, undefined);
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);

  // A Friday start is the one case where the arithmetic surprises
  // people, so the form says what it did rather than leaving a date that
  // looks four days wrong.
  const firstDay = startDate ? notificationFirstDay(startDate) : null;
  const fridayStart = !!firstDay && !!startDate && firstDay !== startDate;

  function onStartChange(value: string) {
    setStartDate(value);
    setEndDate(value ? notificationEndDate(value) || "" : "");
  }

  return (
    <form action={save} className="mt-4 pt-4 border-t border-line">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="text-sm font-semibold text-heading mb-1">Notification period</div>
      <p className="text-xs text-muted mb-2">
        17 days from the day the notice goes out. A notice that starts on a Friday is counted from the following Tuesday.
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] text-placeholder mb-1">Notification start</label>
          <input
            type="date"
            name="start"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
            className="px-2 py-1.5 rounded border border-line text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] text-placeholder mb-1">Notification end</label>
          <input
            type="date"
            name="end"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1.5 rounded border border-line text-xs"
          />
        </div>
        <SaveButton pending={pending} savedAt={state?.savedAt}>
          Save dates
        </SaveButton>
      </div>
      {fridayStart && (
        <p className="text-xs text-warning-text mt-2">
          That start is a Friday, so day one of the 17 is the following Tuesday — the end date above already allows for it.
        </p>
      )}
      {state?.error && <p className="text-xs text-error mt-2">{state.error}</p>}
    </form>
  );
}
