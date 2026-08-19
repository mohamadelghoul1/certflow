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
  const [active, setActive] = useState("CDC");
  const grouped = items.filter((i) => i.pathway === active);

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        These are the documents new projects start with, and what shows up in &ldquo;+ Request documents&rdquo; on every project. Edit this once — no need to type the same items in per project.
      </p>
      <div className="flex gap-2 mb-4">
        {PATHWAYS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${active === p.key ? "bg-teal-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="space-y-2 mb-3">
        {grouped.map((item) => (
          <div key={item.id} className="flex items-center justify-between border border-slate-100 rounded-md px-4 py-2.5">
            <div>
              <div className="text-sm font-semibold text-teal-900">{item.title}</div>
              <div className="text-xs text-slate-500">{item.description}</div>
            </div>
            <form action={removeLibraryItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
            </form>
          </div>
        ))}
        {grouped.length === 0 && <div className="text-sm text-slate-400">No items yet for this checklist type.</div>}
      </div>
      <form action={addLibraryItem} className="flex gap-2">
        <input type="hidden" name="pathway" value={active} />
        <input name="title" placeholder="Document title" required className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm" />
        <input name="description" placeholder="Description (optional)" className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm" />
        <button className="px-3 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 shrink-0">Add</button>
      </form>
    </div>
  );
}
