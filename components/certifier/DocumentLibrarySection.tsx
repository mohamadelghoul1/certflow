"use client";

import { useState } from "react";
import { addLibraryItem, removeLibraryItem } from "@/lib/actions/library";

type LibItem = { id: string; pathway: string; title: string; description: string | null; category: string | null };

const PATHWAYS: { key: string; label: string }[] = [
  { key: "CDC", label: "CDC" },
  { key: "CC", label: "CC" },
  { key: "NOC", label: "Notice of Commencement" },
  { key: "OC", label: "Occupation Certificate" },
];

export function DocumentLibrarySection({ items }: { items: LibItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const grouped = active ? items.filter((i) => i.pathway === active) : [];

  return (
    <div>
      <p className="text-xs text-placeholder mb-3">
        These are the documents new projects start with, and what shows up in &ldquo;+ Request documents&rdquo; on every project. Edit this once — no need to type the same items in per project.
      </p>
      <div className="flex gap-2 mb-4">
        {PATHWAYS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(active === p.key ? null : p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${active === p.key ? "bg-primary text-white" : "border border-line text-muted hover:bg-hover"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!active && <div className="text-sm text-placeholder">Select CDC, CC, Notice of Commencement, or Occupation Certificate above to view or edit its documents.</div>}

      {active && (
        <>
          <div className="space-y-2 mb-3">
            {grouped.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-line rounded-md px-4 py-2.5">
                <div>
                  <div className="text-sm font-semibold text-primary">{item.title}</div>
                  <div className="text-xs text-placeholder">{item.description}</div>
                </div>
                <form action={removeLibraryItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="text-xs text-error hover:underline shrink-0">Remove</button>
                </form>
              </div>
            ))}
            {grouped.length === 0 && <div className="text-sm text-placeholder">No items yet for this checklist type.</div>}
          </div>
          <form action={addLibraryItem} className="flex gap-2">
            <input type="hidden" name="pathway" value={active} />
            <input name="title" placeholder="Document title" required className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <input name="description" placeholder="Description (optional)" className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <button className="px-3 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 shrink-0">Add</button>
          </form>
        </>
      )}
    </div>
  );
}
