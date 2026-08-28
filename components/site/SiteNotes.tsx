"use client";

import { useState, useTransition } from "react";
import { updateInspectionReportText } from "@/lib/actions/inspections";

// Anything that belongs on the report beyond the issues themselves.
//
// The text is never cleared by this component, only by the person
// typing. A failed save leaves every word on screen and says so, because
// the one unforgivable thing on a site with bad signal is losing what
// somebody just wrote.
export function SiteNotes({ inspectionId, jobId, notes }: { inspectionId: string; jobId: string; notes: string }) {
  const [text, setText] = useState(notes);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const dirty = text !== notes;

  function save() {
    if (pending) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("inspection_id", inspectionId);
        fd.set("job_id", jobId);
        fd.set("report_notes", text);
        await updateInspectionReportText(fd);
        setState("saved");
      } catch {
        setState("failed");
      }
    });
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        rows={4}
        placeholder="Anything else worth recording."
        className="w-full px-3 py-3 rounded-lg border border-line text-base outline-none focus:ring-2 focus:ring-icon"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || (!dirty && state !== "failed")}
          className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        {state === "saved" && !dirty && <span className="text-xs text-success font-medium">Saved</span>}
        {state === "failed" && <span className="text-xs text-error">Not saved — your words are still here. Press again when you have signal.</span>}
      </div>
    </div>
  );
}
