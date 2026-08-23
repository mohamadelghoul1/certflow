"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateLetterBody } from "@/lib/actions/jobs";

// The same affordance as the quote's "Edit closing text", on the two
// covering letters of the approval package. The paragraphs render exactly
// as the reader will see them; the edit button is screen-only, so the
// printed and exported documents never show it. Saving stores the whole
// body against the job, and the PDF approved set and Word export pick the
// same wording up automatically.
export function LetterBodyEditor({ jobId, letter, paragraphs, hasOverride }: { jobId: string; letter: "council" | "applicant"; paragraphs: string[]; hasOverride: boolean }) {
  const [editing, setEditing] = useState(false);
  const active = paragraphs.join("\n\n");
  const [draft, setDraft] = useState(active);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await updateLetterBody(formData);
          setEditing(false);
        }}
        className="print:hidden"
      >
        <input type="hidden" name="job_id" value={jobId} />
        <input type="hidden" name="letter" value={letter} />
        <textarea
          name="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 rounded-md border border-line text-sm font-sans outline-none focus:ring-2 focus:ring-icon"
        />
        <div className="text-[11px] text-placeholder mt-1">Leave an empty line between paragraphs.</div>
        <div className="flex gap-2 mt-2">
          <button className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-placeholder hover:bg-hover">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="print:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(active);
            setEditing(true);
          }}
          className="flex items-center gap-1 text-xs text-secondary font-medium hover:underline"
        >
          <Pencil size={12} /> Edit letter text
        </button>
        {hasOverride && (
          <form action={updateLetterBody}>
            <input type="hidden" name="job_id" value={jobId} />
            <input type="hidden" name="letter" value={letter} />
            <input type="hidden" name="text" value="" />
            <button className="text-xs text-placeholder hover:underline">Reset to auto-generated</button>
          </form>
        )}
      </div>
      {paragraphs.map((para, i) => (
        <div key={i} className="whitespace-pre-line">
          {para}
        </div>
      ))}
    </>
  );
}
