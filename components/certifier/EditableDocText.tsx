"use client";

import { useState, useTransition } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { updateDocText } from "@/lib/actions/jobs";

// Any block of wording on a generated document, made editable in place.
//
// The letters are the firm's own voice, and the standard wording never
// suits every job — a covering letter often needs a line added for this
// client, or a requirement dropped because it does not apply. Rather
// than a settings screen full of templates, each block is edited where
// it is read, in the document itself.
//
// The edit controls are screen-only: what prints, exports to Word and
// goes into the approved set is the text alone.
export function EditableDocText({
  jobId,
  docKey,
  value,
  overridden,
  label,
  className,
  as = "paragraphs",
  rows = 3,
}: {
  jobId: string;
  docKey: string;
  // The wording as it currently reads, standard or overridden.
  value: string;
  overridden: boolean;
  label: string;
  className?: string;
  // Paragraphs separated by a blank line, or one list item per line.
  as?: "paragraphs" | "lines" | "inline";
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [, startTransition] = useTransition();
  // What is on screen while the save travels, so editing never flickers
  // back to the old wording.
  const [shown, setShown] = useState(value);

  function save(text: string) {
    setShown(text);
    setEditing(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("job_id", jobId);
      fd.set("key", docKey);
      fd.set("text", text);
      await updateDocText(fd);
    });
  }

  if (editing) {
    return (
      <div className="print:hidden">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={rows}
          autoFocus
          className="w-full px-3 py-2 rounded-md border border-icon text-sm font-sans outline-none focus:ring-2 focus:ring-icon"
        />
        <div className="text-[11px] text-placeholder mt-1">
          {as === "lines" ? "One item per line." : as === "paragraphs" ? "Leave an empty line between paragraphs." : "A single line of text."}
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => save(draft)} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-placeholder hover:bg-hover">
            Cancel
          </button>
          {overridden && (
            <button type="button" onClick={() => save("")} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-placeholder hover:bg-hover">
              <RotateCcw size={11} /> Reset to standard wording
            </button>
          )}
        </div>
      </div>
    );
  }

  const text = shown;

  return (
    <div className="group relative">
      {/* Sits over the text rather than in the flow, so turning a block
          editable never moves the document around. */}
      <button
        type="button"
        title={`Edit ${label}`}
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
        className="print:hidden absolute -left-6 top-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-placeholder hover:text-secondary transition-opacity"
      >
        <Pencil size={13} />
      </button>
      <div className={className}>
        {as === "lines" ? (
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {text
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
        ) : as === "inline" ? (
          text
        ) : (
          text
            .split("\n\n")
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para, i) => (
              <div key={i} className="whitespace-pre-line">
                {para}
              </div>
            ))
        )}
      </div>
    </div>
  );
}
