"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addDefect, removeDefect } from "@/lib/actions/inspections";
import { issuesSection } from "@/lib/inspectionIssues";
import { quickItemsFor, isQuickItem } from "@/lib/inspectionQuickItems";
import { useSiteOutcome } from "@/components/site/SiteOutcome";

type Issue = { id: string; text: string };
type Action = { type: "add"; issue: Issue } | { type: "remove"; id: string };

function reducer(state: Issue[], action: Action): Issue[] {
  return action.type === "add" ? [...state, action.issue] : state.filter((i) => i.id !== action.id);
}

// What was wrong, typed one item at a time.
//
// Every press lands on the screen at once and the save travels behind
// it. It used to wait: a tick box stayed unticked, and a typed item
// stayed in the box, until the server had answered — which on a slab
// with one bar of signal is a second or two of a screen that looks
// broken, and a person pressing again. The list is held optimistically
// now, the same way the outcome buttons above it already were.
//
// Nothing typed is ever thrown away. A save that fails puts the item
// back in the box with the reason, so the words are still there to send
// again once there is signal.
export function SiteIssues({
  inspectionId,
  jobId,
  title,
  issues,
}: {
  inspectionId: string;
  jobId: string;
  title: string;
  issues: Issue[];
}) {
  // A satisfactory inspection is waiting on documents, not defects, so
  // the box asks for the right thing — see lib/inspectionIssues.
  const { outcome } = useSiteOutcome();
  const [list, dispatch] = useOptimistic(issues, reducer);
  const { placeholder, addLabel } = issuesSection(outcome, list.length > 0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The standard document lines for this stage, offered as tick boxes so
  // they need not be typed on a phone — see lib/inspectionQuickItems.
  const quickItems = quickItemsFor(title);
  const quickRowFor = (item: string) => list.find((i) => i.text.trim().toLowerCase() === item.trim().toLowerCase());
  const typedIssues = list.filter((i) => !isQuickItem(i.text, quickItems));

  function add(value: string, onFail?: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setError("");
    startTransition(async () => {
      // A stand-in id until the server hands back the real row, so the
      // item is on screen the instant it is added.
      dispatch({ type: "add", issue: { id: `temp-${Math.random().toString(36).slice(2)}`, text: trimmed } });
      try {
        const fd = new FormData();
        fd.set("inspection_id", inspectionId);
        fd.set("job_id", jobId);
        fd.set("text", trimmed);
        await addDefect(fd);
      } catch {
        setError("That didn't save — check your signal and try again.");
        onFail?.();
      }
    });
  }

  function remove(id: string) {
    setError("");
    startTransition(async () => {
      dispatch({ type: "remove", id });
      try {
        const fd = new FormData();
        fd.set("defect_id", id);
        fd.set("job_id", jobId);
        await removeDefect(fd);
      } catch {
        setError("That didn't save — check your signal and try again.");
      }
    });
  }

  function toggleQuickItem(item: string, ticked: boolean) {
    if (ticked) {
      if (quickRowFor(item)) return;
      add(item);
    } else {
      const row = quickRowFor(item);
      if (row) remove(row.id);
    }
  }

  function addTyped() {
    const value = text;
    // Cleared on the press, and put back if the save fails — waiting for
    // the server to clear it is most of what made this screen feel slow.
    setText("");
    add(value, () => {
      setText((current) => current || value);
      inputRef.current?.focus();
    });
  }

  return (
    <div>
      {quickItems.length > 0 && (
        <div className="space-y-2 mb-3">
          {quickItems.map((item) => (
            <label key={item} className="flex items-start gap-3 rounded-lg border border-line bg-white px-3 py-3 text-sm text-heading leading-snug cursor-pointer">
              <input
                type="checkbox"
                checked={!!quickRowFor(item)}
                onChange={(e) => toggleQuickItem(item, e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-icon shrink-0"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      )}
      {typedIssues.length > 0 && (
        <ul className="space-y-2 mb-3">
          {typedIssues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-2 bg-warning-bg border border-warning/50 rounded-lg px-3 py-3">
              <span className="flex-1 text-sm text-warning-text leading-snug">{issue.text}</span>
              <button
                type="button"
                onClick={() => remove(issue.id)}
                aria-label="Remove this issue"
                className="shrink-0 -m-1 p-1 text-warning-text/70 hover:text-error"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-3 rounded-lg border border-line text-base outline-none focus:ring-2 focus:ring-icon"
      />
      <button
        type="button"
        onClick={addTyped}
        disabled={!text.trim()}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white py-3 font-semibold disabled:opacity-40"
      >
        <Plus size={18} /> {addLabel}
      </button>
      {error && <div className="text-xs text-error mt-2">{error}</div>}
    </div>
  );
}
