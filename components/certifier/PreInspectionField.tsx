"use client";

import { useActionState, useState } from "react";
import { FileSearch, Pencil } from "lucide-react";
import Link from "next/link";
import { setPreInspectionDates } from "@/lib/actions/jobs";
import { DateField } from "@/components/DateField";
import { formatISODate } from "@/lib/business";
import type { ActionState } from "@/lib/actions/auth";
import { SaveButton } from "@/components/certifier/SaveButton";

// The pre-inspection report — s139 of the EP&A Regulation 2021 for a CDC,
// s16 of the EP&A (Development Certification and Fire Safety) Regulation
// 2021 for a CC.
//
// Sits where the certificate is issued, like the Planning Portal
// reference, for the same reason: the report is written just before the
// certificate goes out, and sending a certifier to the Details tab for
// two dates at that moment is how a report goes out with a blank on it.
// Everything else on the report already comes from the job.
export function PreInspectionField({
  jobId,
  isCdc,
  applicationDate,
  inspectionDate,
  modificationId,
}: {
  jobId: string;
  isCdc: boolean;
  applicationDate: string;
  inspectionDate: string;
  // Given, the dates save to that modification and the report link opens
  // the modification's own report — each modification carries its own
  // pre-inspection, distinct from the original certificate's.
  modificationId?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setPreInspectionDates, undefined);
  const [editing, setEditing] = useState(false);
  const recorded = applicationDate.trim() && inspectionDate.trim();
  const label = isCdc ? "s139 inspection report" : "s16 inspection report";
  const reportHref = modificationId ? `/certificate/pre-inspection/${jobId}?mod=${modificationId}` : `/certificate/pre-inspection/${jobId}`;

  if (recorded && !editing) {
    return (
      <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted">
        <span>
          {label}: applied <span className="font-semibold text-heading">{formatISODate(applicationDate)}</span>, inspected{" "}
          <span className="font-semibold text-heading">{formatISODate(inspectionDate)}</span>
        </span>
        <Link href={reportHref} target="_blank" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
          <FileSearch size={12} /> Open report
        </Link>
        <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-secondary hover:underline">
          <Pencil size={11} /> Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex items-end gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      {modificationId && <input type="hidden" name="modification_id" value={modificationId} />}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-heading">Application date</span>
        <DateField name="applicationDate" noFuture defaultValue={applicationDate} className="px-2 py-1.5 rounded border border-line text-xs" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-heading">Inspection date</span>
        <DateField name="inspectionDate" noFuture defaultValue={inspectionDate} autoFocus={editing} className="px-2 py-1.5 rounded border border-line text-xs" />
      </label>
      <SaveButton
        pending={pending}
        savedAt={state?.savedAt}
        className="text-xs font-semibold text-white bg-secondary hover:opacity-90 px-3 py-1.5 rounded-md disabled:opacity-60"
      >
        Save
      </SaveButton>
      {editing && (
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:underline px-1 py-1.5">
          Cancel
        </button>
      )}
      {!recorded && !state?.error && <span className="text-xs text-muted pb-1.5">The two dates the {label} needs — everything else comes from the job.</span>}
      {state?.error && <span className="text-xs text-error pb-1.5">{state.error}</span>}
    </form>
  );
}
