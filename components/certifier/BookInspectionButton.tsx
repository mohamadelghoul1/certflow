"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { bookInspection } from "@/lib/actions/inspections";
import { formatISODate, fallsOnWeekend, suggestedInspectionBookingDate } from "@/lib/business";
import { DateField } from "@/components/DateField";
import type { ActionState } from "@/lib/actions/auth";

// The certifier booking an inspection themselves.
//
// Until now a date could only be set two ways: the client asked for one
// from their portal and the certifier answered it, or the certifier
// recorded the date of a visit that had already happened. Neither covers
// the ordinary case of a certifier picking a day, putting it in the diary
// and telling the builder — which is most of them.
//
// Deliberately not the date box beside it: that box records when a visit
// happened and refuses a future date. This one takes the future date and
// emails the client.
export function BookInspectionButton({
  inspectionId,
  jobId,
  bookedDate,
  confirmed,
}: {
  inspectionId: string;
  jobId: string;
  // The day currently booked, if any — shown so a rebooking says what it
  // is moving from.
  bookedDate: string | null;
  confirmed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => suggestedInspectionBookingDate(""));
  const [state, book, pending] = useActionState<ActionState, FormData>(bookInspection, undefined);

  // Closes itself once the booking lands, so the card goes back to
  // showing the booked day rather than leaving the picker open over it.
  const [dismissed, setDismissed] = useState<number | undefined>();
  if (state?.savedAt && state.savedAt !== dismissed) {
    setDismissed(state.savedAt);
    setOpen(false);
  }

  const booked = confirmed && bookedDate;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDate(suggestedInspectionBookingDate(bookedDate || ""));
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary border border-line rounded-md px-3 py-1.5 hover:bg-hover whitespace-nowrap"
      >
        <CalendarPlus size={13} /> {booked ? "Change the booking" : "Book this inspection"}
      </button>
    );
  }

  return (
    <form action={book} className="border border-line rounded-lg bg-white p-3 w-full">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <input type="hidden" name="job_id" value={jobId} />
      <input type="hidden" name="date" value={date} />
      <label className="block text-[11px] font-semibold text-heading mb-1">
        {booked ? `Currently booked for ${formatISODate(bookedDate)}. Move it to` : "Inspect on"}
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        {/* No future limit: this is a day being booked, not a visit being
            recorded. */}
        <DateField value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1.5 rounded border border-line text-xs bg-white" />
        <button
          disabled={pending}
          className="bg-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-primary-700 disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "Booking…" : "Book it and tell the client"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
          Cancel
        </button>
      </div>
      {fallsOnWeekend(date) && <div className="text-[11px] text-warning-text mt-1">⚠ falls on a weekend</div>}
      {state?.error && <div className="text-[11px] text-error mt-1">{state.error}</div>}
    </form>
  );
}
