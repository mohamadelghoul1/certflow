"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addDefect, removeDefect } from "@/lib/actions/inspections";
import { issuesSection } from "@/lib/inspectionIssues";
import { quickItemsFor, isQuickItem } from "@/lib/inspectionQuickItems";
import { useSiteOutcome } from "@/components/site/SiteOutcome";

// What was wrong, typed one item at a time.
//
// Each issue is saved the moment it is added rather than held in a form
// until the end: on a site with poor signal, a page that loses six typed
// issues at once is a page nobody uses twice. If the save fails the text
// stays in the box, so nothing typed is ever thrown away.
export function SiteIssues({
  inspectionId,
  jobId,
  title,
  issues,
}: {
  inspectionId: string;
  jobId: string;
  title: string;
  issues: { id: string; text: string }[];
}) {
  // A satisfactory inspection is waiting on documents, not defects, so
  // the box asks for the right thing — see lib/inspectionIssues.
  const { outcome } = useSiteOutcome();
  const { placeholder, addLabel } = issuesSection(outcome, issues.length > 0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The standard document lines for this stage, offered as tick boxes so
  // they need not be typed on a phone — see lib/inspectionQuickItems.
  // Like everything on this screen there is no optimistic state: the box
  // ticks once the server has it, and stays as it was if the save fails.
  const quickItems = quickItemsFor(title);
  const quickRowFor = (item: string) => issues.find((i) => i.text.trim().toLowerCase() === item.trim().toLowerCase());
  const typedIssues = issues.filter((i) => !isQuickItem(i.text, quickItems));

  function toggleQuickItem(item: string, ticked: boolean) {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("job_id", jobId);
        if (ticked) {
          if (quickRowFor(item)) return;
          fd.set("inspection_id", inspectionId);
          fd.set("text", item);
          await addDefect(fd);
        } else {
          const row = quickRowFor(item);
          if (!row) return;
          fd.set("defect_id", row.id);
          await removeDefect(fd);
        }
      } catch {
        setError("That didn't save — check your signal and tap it again.");
      }
    });
  }

  function add() {
    const value = text.trim();
    if (!value || pending) return;
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("inspection_id", inspectionId);
        fd.set("job_id", jobId);
        fd.set("text", value);
        await addDefect(fd);
        // Cleared only once the server has it.
        setText("");
        inputRef.current?.focus();
      } catch {
        setError("That didn't save — check your signal and press Add again. What you typed is still here.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("defect_id", id);
      fd.set("job_id", jobId);
      await removeDefect(fd);
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
                disabled={pending}
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
        onClick={add}
        disabled={pending || !text.trim()}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white py-3 font-semibold disabled:opacity-40"
      >
        <Plus size={18} /> {pending ? "Adding…" : addLabel}
      </button>
      {error && <div className="text-xs text-error mt-2">{error}</div>}
    </div>
  );
}
