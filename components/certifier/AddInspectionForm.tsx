"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { addInspection } from "@/lib/actions/inspections";
import { INSPECTION_SUGGESTIONS } from "@/lib/constants";
import { DateField } from "@/components/DateField";
import type { ActionState } from "@/lib/actions/auth";

// Adding an inspection the standard set doesn't cover — a pool steel or
// suspended slab inspection, an OSD system, a fire rated wall — or a
// second run at a stage that failed and has to be carried out again.
//
// The suggestions are a shortcut, not a limit: the field is free text, so
// a stage nobody anticipated can still be added, and a repeat can be
// labelled for what it is ("Slab Steel — re-inspection") rather than
// sitting in the list as an identical twin of the first.
export function AddInspectionForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addInspection, undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Cleared once the inspection is actually added, so the field is ready
  // for the next one — but never on a failure, which would throw away
  // what was typed along with the reason it didn't save.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error && inputRef.current) inputRef.current.value = "";
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div className="border border-dashed border-line rounded-xl p-4 bg-white">
      <div className="text-sm font-semibold text-heading mb-1">Add an inspection</div>
      <p className="text-xs text-muted mb-3">
        For a stage this job needs beyond the standard set, or one that has to be carried out again. Pick from the list or type any name. Give it a
        day and the client is told it has been booked.
      </p>
      <form action={formAction} className="flex items-end gap-2 flex-wrap">
        <input type="hidden" name="job_id" value={jobId} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-heading">Inspection</span>
          <input
            ref={inputRef}
            name="title"
            list="inspection-suggestions"
            placeholder="e.g. Pool Steel"
            className="px-2 py-1.5 rounded border border-line text-xs w-72"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-heading">Book it for (optional)</span>
          {/* No future limit: this is a day being booked, not a visit
              being recorded. Left blank the inspection is simply added to
              the list, and a day can be booked on its card later. */}
          <DateField name="date" className="px-2 py-1.5 rounded border border-line text-xs" />
        </label>
        <datalist id="inspection-suggestions">
          {INSPECTION_SUGGESTIONS.map((i) => (
            <option key={i.title} value={i.title}>
              {i.desc}
            </option>
          ))}
        </datalist>
        <label className="flex items-center gap-2 pb-2 text-[11px] text-muted cursor-pointer">
          {/* Only means anything alongside a date. Ticked by default: a
              booking the builder does not know about is not a booking. */}
          <input type="checkbox" name="notify" value="yes" defaultChecked className="accent-icon" />
          Email the client
        </label>
        <button
          disabled={pending}
          className="flex items-center gap-1 text-xs font-semibold text-white bg-secondary hover:opacity-90 px-3 py-1.5 rounded-md disabled:opacity-60"
        >
          <Plus size={12} /> {pending ? "Adding…" : "Add inspection"}
        </button>
        {state?.error && <span className="text-xs text-error pb-1.5">{state.error}</span>}
      </form>
    </div>
  );
}
