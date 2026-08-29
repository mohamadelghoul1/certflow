"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addDefect, removeDefect } from "@/lib/actions/inspections";
import { issuesSection } from "@/lib/inspectionIssues";
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
  issues,
}: {
  inspectionId: string;
  jobId: string;
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
      {issues.length > 0 && (
        <ul className="space-y-2 mb-3">
          {issues.map((issue) => (
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
