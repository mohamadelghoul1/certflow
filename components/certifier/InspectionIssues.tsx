"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addDefect, updateDefect, removeDefect } from "@/lib/actions/inspections";
import type { Defect } from "@/types/db";

// The issues found on an inspection — the defects and conditions the
// report names when the outcome is a failure or "subject to documents".
//
// They are a record of what was seen on the day, not a checklist to work
// through here: the report goes out naming them, and whether they get
// rectified shows up as the next inspection. So there is nothing to mark
// resolved and nothing to wait for — the report can be generated and
// signed the moment they are written down.
//
// Each one is an ordinary text box that saves when you click away, like
// the document details boxes. A typed issue left behind was meant to be
// kept; losing it because a button went unpressed is the worse outcome.

type IssueAction = { type: "add"; defect: Defect } | { type: "update"; id: string; text: string } | { type: "remove"; id: string };

function reducer(state: Defect[], action: IssueAction): Defect[] {
  switch (action.type) {
    case "add":
      return [...state, action.defect];
    case "update":
      return state.map((d) => (d.id === action.id ? { ...d, text: action.text } : d));
    case "remove":
      return state.filter((d) => d.id !== action.id);
  }
}

export function InspectionIssues({
  inspectionId,
  jobId,
  defects,
  title,
  placeholder,
  hint,
}: {
  inspectionId: string;
  jobId: string;
  defects: Defect[];
  // What this list is called on this outcome — issues on a failed
  // inspection, documents still owed on a satisfactory one. See
  // lib/inspectionIssues.
  title: string;
  placeholder: string;
  hint?: string;
}) {
  const [list, dispatch] = useOptimistic(defects, reducer);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    // A stand-in id until the server hands back the real row, so the issue
    // is on screen the instant it's typed.
    const temp: Defect = { id: `temp-${Math.random().toString(36).slice(2)}`, inspection_id: inspectionId, text: trimmed, resolved: false, created_at: new Date().toISOString(), resolved_at: null };
    startTransition(async () => {
      dispatch({ type: "add", defect: temp });
      const fd = new FormData();
      fd.set("inspection_id", inspectionId);
      fd.set("job_id", jobId);
      fd.set("text", trimmed);
      await addDefect(fd);
    });
    setDraft("");
  }

  function handleUpdate(id: string, text: string, original: string) {
    const trimmed = text.trim();
    if (trimmed === original.trim()) return;
    startTransition(async () => {
      // Emptying the box is how an issue is dropped, so the row goes with it.
      dispatch(trimmed ? { type: "update", id, text: trimmed } : { type: "remove", id });
      const fd = new FormData();
      fd.set("defect_id", id);
      fd.set("job_id", jobId);
      fd.set("text", trimmed);
      await updateDefect(fd);
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      dispatch({ type: "remove", id });
      const fd = new FormData();
      fd.set("defect_id", id);
      fd.set("job_id", jobId);
      await removeDefect(fd);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[11px] font-semibold text-muted">{title}</div>
      {hint && <p className="text-[11px] text-warning-text bg-warning-bg rounded-md px-2.5 py-1.5">{hint}</p>}
      {list.map((d) => (
        <div key={d.id} className="flex items-center gap-2">
          <input
            defaultValue={d.text}
            onBlur={(e) => handleUpdate(d.id, e.target.value, d.text)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="flex-1 px-3 py-2 rounded-md border border-warning-bg bg-warning-bg text-warning-text text-xs"
          />
          <button type="button" onClick={() => handleRemove(d.id)} className="text-[11px] text-error hover:underline shrink-0">
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={handleAdd}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Clicking away saves it. Enter still works; when Add is what you
          // click, this fires first and the button's handler then finds the
          // box already empty and does nothing.
          onBlur={() => handleAdd()}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-md border border-line text-xs"
        />
      </form>
    </div>
  );
}
