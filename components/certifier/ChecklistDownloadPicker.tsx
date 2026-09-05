"use client";

import { useState } from "react";
import { FolderDown, X } from "lucide-react";
import { DownloadButton } from "@/components/certifier/DownloadButton";

export type PickableDocument = { key: string; fileName: string; itemTitle: string };

// Download the whole checklist, or the part of it you actually want.
//
// A certifier reading a set does not always want all twenty documents —
// they want the plans and the engineering, not the twelve certificates
// they have already read. So the button opens the list, everything
// ticked, and untick what you don't need.
export function ChecklistDownloadPicker({ jobId, checklistId, label, documents }: { jobId: string; checklistId: string; label: string; documents: PickableDocument[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(documents.map((d) => d.key)));

  if (documents.length === 0) return null;

  const all = chosen.size === documents.length;
  const none = chosen.size === 0;
  // Everything ticked is the plain download, and asks for the shortest
  // address: no list of keys at all.
  const href = all
    ? `/api/jobs/${jobId}/checklists/${checklistId}/documents`
    : `/api/jobs/${jobId}/checklists/${checklistId}/documents?docs=${encodeURIComponent([...chosen].join(","))}`;

  function toggle(key: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
      >
        <FolderDown size={13} /> Download {documents.length} document{documents.length === 1 ? "" : "s"}
      </button>
    );
  }

  return (
    <div className="w-full sm:w-[26rem] rounded-lg border border-line bg-surface p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-heading">Which documents?</div>
          <div className="text-[11px] text-muted mt-0.5">
            {none ? "Nothing selected" : `${chosen.size} of ${documents.length} selected`}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-placeholder hover:text-muted shrink-0">
          <X size={15} />
        </button>
      </div>

      <div className="mt-2 flex gap-3 text-[11px] font-semibold">
        <button type="button" onClick={() => setChosen(new Set(documents.map((d) => d.key)))} className="text-secondary hover:underline">
          Select all
        </button>
        <button type="button" onClick={() => setChosen(new Set())} className="text-secondary hover:underline">
          Select none
        </button>
      </div>

      {/* Its own scroll: a twenty-item checklist must not push the page
          about, and the button below has to stay reachable. */}
      <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-line border-y border-line">
        {documents.map((doc) => (
          <li key={doc.key}>
            <label className="flex items-start gap-2.5 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chosen.has(doc.key)}
                onChange={() => toggle(doc.key)}
                className="mt-0.5 accent-primary shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-heading truncate">{doc.itemTitle}</span>
                <span className="block text-[11px] text-placeholder truncate">{doc.fileName}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {none ? (
          <span className="text-xs text-placeholder">Tick at least one document.</span>
        ) : (
          <DownloadButton
            href={href}
            fallbackName={`${label} Documents.zip`}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
            preparingLabel="Zipping…"
          >
            <FolderDown size={13} /> Download {chosen.size} document{chosen.size === 1 ? "" : "s"}
          </DownloadButton>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
