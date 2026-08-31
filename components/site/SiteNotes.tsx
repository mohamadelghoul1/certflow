"use client";

import { useState, useTransition } from "react";
import { updateInspectionNotes } from "@/lib/actions/inspections";

// Anything that belongs on the report beyond the issues themselves.
//
// The text is never cleared by this component, only by the person
// typing. A failed save leaves every word on screen and says so, because
// the one unforgivable thing on a site with bad signal is losing what
// somebody just wrote.
export function SiteNotes({ inspectionId, jobId, notes }: { inspectionId: string; jobId: string; notes: string }) {
  const [text, setText] = useState(notes);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  // What has been sent, so the button settles the moment it is pressed
  // rather than after the server has answered. Waiting for that answer
  // on a site with one bar of signal is a button that looks stuck.
  const [sent, setSent] = useState(notes);
  const [, startTransition] = useTransition();
  const dirty = text !== sent;

  function save() {
    const saving = text;
    setSent(saving);
    setState("saved");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("inspection_id", inspectionId);
        fd.set("job_id", jobId);
        fd.set("report_notes", saving);
        await updateInspectionNotes(fd);
      } catch {
        // Nothing typed is lost: the words stay on screen, the button
        // comes back, and the note says to press it again.
        setSent(notes);
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
          disabled={!dirty && state !== "failed"}
          className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
        >
          Save notes
        </button>
        {state === "saved" && !dirty && <span className="text-xs text-success font-medium">Saved</span>}
        {state === "failed" && <span className="text-xs text-error">Not saved — your words are still here. Press again when you have signal.</span>}
      </div>
    </div>
  );
}
