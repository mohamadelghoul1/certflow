"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { confirmBooking, rescheduleBooking } from "@/lib/actions/inspections";
import { formatISODate, fallsOnWeekend, suggestedInspectionBookingDate } from "@/lib/business";
import { DateField } from "@/components/DateField";
import type { ActionState } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

// A booking the client asked for and the certifier has not answered.
//
// Presented as the decision it is — accept the day, or offer another —
// rather than a lone "confirm" link beside a date box that refuses
// future dates. The client's portal is holding their request open until
// one of these two buttons is pressed, so it is deliberately hard to
// miss.
export function BookingDecision({ inspectionId, jobId, requestedDate }: { inspectionId: string; jobId: string; requestedDate: string | null }) {
  const [choosing, setChoosing] = useState(false);
  const [date, setDate] = useState(() => suggestedInspectionBookingDate(""));
  const [state, reschedule, rescheduling] = useActionState<ActionState, FormData>(rescheduleBooking, undefined);

  return (
    <div className="mt-3 border border-warning/50 bg-warning-bg rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-text">
        <CalendarClock size={14} className="shrink-0" />
        Your client asked for {requestedDate ? formatISODate(requestedDate) : "a date"} — they are waiting on you
      </div>
      {requestedDate && fallsOnWeekend(requestedDate) && <div className="text-[11px] text-warning-text mt-1">⚠ that day falls on a weekend</div>}

      {!choosing ? (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <form action={confirmBooking}>
            <input type="hidden" name="inspection_id" value={inspectionId} />
            <input type="hidden" name="job_id" value={jobId} />
            <SubmitButton className="inline-flex items-center gap-1.5 bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">
              <Check size={13} /> Accept this date
            </SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="border border-line bg-white rounded-md px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-hover"
          >
            Offer another date
          </button>
        </div>
      ) : (
        <form action={reschedule} className="mt-2.5">
          <input type="hidden" name="inspection_id" value={inspectionId} />
          <input type="hidden" name="job_id" value={jobId} />
          <label className="block text-[11px] font-semibold text-warning-text mb-1">Inspect on</label>
          <div className="flex items-center gap-2 flex-wrap">
            {/* No future limit here: this is a day being booked, not a
                visit being recorded. */}
            <input type="hidden" name="date" value={date} />
            <DateField value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1.5 rounded border border-line text-xs bg-white" />
            <button
              disabled={rescheduling}
              className="bg-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
            >
              {rescheduling ? "Saving…" : "Book this date and tell the client"}
            </button>
            <button type="button" onClick={() => setChoosing(false)} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
          {fallsOnWeekend(date) && <div className="text-[11px] text-warning-text mt-1">⚠ falls on a weekend</div>}
          {state?.error && <div className="text-[11px] text-error mt-1">{state.error}</div>}
        </form>
      )}
    </div>
  );
}
