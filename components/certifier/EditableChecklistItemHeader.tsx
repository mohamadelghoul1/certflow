"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateItemDetails } from "@/lib/actions/jobs";

export function EditableChecklistItemHeader({
  itemId,
  jobId,
  title,
  description,
  version,
  statusDot,
}: {
  itemId: string;
  jobId: string;
  title: string;
  description: string;
  version: number;
  statusDot: string;
}) {
  const [editing, setEditing] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displayDescription, setDisplayDescription] = useState(description);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    setDisplayTitle(trimmed);
    setDisplayDescription(draftDescription.trim());
    setEditing(false);
    const fd = new FormData();
    fd.set("item_id", itemId);
    fd.set("job_id", jobId);
    fd.set("title", trimmed);
    fd.set("description", draftDescription.trim());
    updateItemDetails(fd);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
        {!editing && (
          <>
            <span className="text-sm font-semibold text-teal-900">{displayTitle}</span>
            {version > 0 && <span className="text-[11px] text-slate-400">v{version}</span>}
            <button
              onClick={() => {
                setDraftTitle(displayTitle);
                setDraftDescription(displayDescription);
                setEditing(true);
              }}
              aria-label="Edit document name/description"
              className="p-0.5 rounded text-slate-300 hover:text-teal-700 shrink-0"
            >
              <Pencil size={12} />
            </button>
          </>
        )}
        {editing && <span className="text-sm font-semibold text-teal-900">Editing…</span>}
      </div>

      {!editing && displayDescription && <div className="text-xs text-slate-500 mt-0.5">{displayDescription}</div>}

      {editing && (
        <form onSubmit={save} className="mt-1.5 space-y-1.5 max-w-sm">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            autoFocus
            placeholder="Document name"
            className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
          />
          <textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            rows={2}
            placeholder="Description"
            className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
          />
          <div className="flex gap-2">
            <button type="submit" className="text-xs font-semibold text-teal-800 hover:underline">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
