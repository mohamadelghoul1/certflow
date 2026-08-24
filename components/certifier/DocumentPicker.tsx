"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { addChecklistItems } from "@/lib/actions/jobs";

// id is absent on the one-off documents typed straight into the picker.
type LibItem = { id?: string; title: string; desc: string; category: string };

export function DocumentPicker({ jobId, checklistId, library, existingTitles }: { jobId: string; checklistId: string; library: LibItem[]; existingTitles: string[] }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const [customItems, setCustomItems] = useState<{ title: string; desc: string }[]>([]);

  const toggle = (t: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const addCustom = () => {
    const text = customText.trim();
    if (!text) return;
    setCustomItems((prev) => [...prev, { title: text, desc: "Custom document request." }]);
    setCustomText("");
  };

  const selected: LibItem[] = [...library.filter((l) => checked.has(l.title)), ...customItems.map((c) => ({ ...c, category: "Other" }))];

  async function confirm() {
    if (selected.length === 0) return;
    const fd = new FormData();
    fd.set("job_id", jobId);
    fd.set("checklist_id", checklistId);
    selected.forEach((s) => {
      fd.append("title", s.title);
      fd.append("desc", s.desc);
      fd.append("category", s.category);
      // Sent for every row so the three lists stay index-aligned on the
      // server; empty means "no library item, so no blank form".
      fd.append("library_item_id", s.id || "");
    });
    await addChecklistItems(fd);
    setOpen(false);
    setChecked(new Set());
    setCustomItems([]);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-primary hover:underline">
        + Request documents
      </button>
    );
  }

  // Portalled to <body>: rendered in place, a hover transform on an
  // ancestor card would re-anchor this fixed overlay to the card and make
  // it jump — see StampPositioner for the full story.
  return createPortal(
    <div className="fixed inset-0 bg-heading/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-bold text-primary">Request documents</h3>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-surface text-placeholder">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-2">
          <div className="text-[11px] font-semibold tracking-wide text-placeholder mb-1">COMMON ITEMS</div>
          {library.map((item) => {
            const already = existingTitles.includes(item.title);
            return (
              <label key={item.title} className={`flex items-start gap-3 p-2.5 rounded-md border ${already ? "border-line bg-surface opacity-50" : "border-line hover:bg-hover/50 cursor-pointer"}`}>
                <input type="checkbox" disabled={already} checked={checked.has(item.title)} onChange={() => toggle(item.title)} className="mt-1 accent-icon" />
                <div>
                  <div className="text-sm font-semibold text-primary">{item.title}</div>
                  <div className="text-xs text-placeholder">{already ? "Already on this checklist" : item.desc}</div>
                </div>
              </label>
            );
          })}
          <div className="text-[11px] font-semibold tracking-wide text-placeholder mt-4 mb-1">ADD YOUR OWN</div>
          <div className="flex gap-2">
            <input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="e.g. Acoustic report"
              className="flex-1 px-3 py-2 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-icon"
            />
            <button type="button" onClick={addCustom} className="px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-700">
              Add
            </button>
          </div>
          {customItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customItems.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-hover text-primary text-xs font-medium">
                  {c.title}
                  <button onClick={() => setCustomItems((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-sm text-muted hover:bg-hover">
            Cancel
          </button>
          <button onClick={confirm} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
            Add to checklist
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
