"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateLetterBody } from "@/lib/actions/jobs";
import { useCommitOnOutsidePress } from "@/lib/useCommitOnOutsidePress";

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
  const [, startTransition] = useTransition();
  // What is on screen while the save travels, so the letter never
  // flickers back to the old wording. null means "whatever the server
  // last sent", which is what a reset needs — the auto-generated
  // wording only exists there.
  const [shown, setShown] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  function save(text: string) {
    setShown(text || null);
    setEditing(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("letter", letter);
      fd.set("text", text);
      await updateLetterBody(fd);
    });
  }

  // Pressing anywhere else on the page keeps the edit rather than
  // discarding it — the Save button stays for anyone who looks for one.
  const markHandled = useCommitOnOutsidePress(boxRef, editing, () => save(draft));

  if (editing) {
    return (
      <div ref={boxRef} className="print:hidden">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          autoFocus
          className="w-full px-3 py-2 rounded-md border border-line text-sm font-sans outline-none focus:ring-2 focus:ring-icon"
        />
        <div className="text-[11px] text-placeholder mt-1">Leave an empty line between paragraphs. Press anywhere outside to save.</div>
        <div className="flex gap-2 mt-2">
          <button type="button" onPointerDown={markHandled} onClick={() => save(draft)} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">
            Save
          </button>
          <button type="button" onPointerDown={markHandled} onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-placeholder hover:bg-hover">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const text = shown ?? active;

  return (
    <>
      <div className="print:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
          className="flex items-center gap-1 text-xs text-secondary font-medium hover:underline"
        >
          <Pencil size={12} /> Edit letter text
        </button>
        {hasOverride && (
          <button type="button" onClick={() => save("")} className="text-xs text-placeholder hover:underline">
            Reset to auto-generated
          </button>
        )}
      </div>
      {text
        .split("\n\n")
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          <div key={i} className="whitespace-pre-line">
            {para}
          </div>
        ))}
    </>
  );
}
