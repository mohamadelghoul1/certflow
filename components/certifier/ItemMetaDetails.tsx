"use client";

import { useRef, useState, useTransition } from "react";
import { updateItemMeta } from "@/lib/actions/jobs";
import { DateField, todayISO } from "@/components/DateField";
import type { ChecklistItem } from "@/types/db";

const fieldCls = "px-2 py-1.5 rounded border border-line text-xs";

// The details panel for an item with no document yet. Before this, the
// panel opened onto nothing for such items and looked broken. The
// values are kept on the item and travel onto the document the moment
// one is uploaded.
export function ItemMetaDetails({ item, jobId }: { item: ChecklistItem; jobId: string }) {
  const today = todayISO();
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSent = useRef<Record<string, string>>({
    prepared_by: item.prepared_by || "",
    drawing_number: item.drawing_number || "",
    revision: item.revision || "",
    document_date: item.document_date || "",
  });
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(name: string, value: string) {
    if (lastSent.current[name] === value) return;
    lastSent.current[name] = value;
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    // Confirmed on the spot; the write itself finishes in the background.
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
    startTransition(async () => {
      await updateItemMeta(fd);
    });
  }

  return (
    <form ref={formRef} className="mt-3">
      <p className="text-[11px] text-muted mb-2">No document uploaded yet — these details will attach to it when it arrives.</p>
      <div className="grid sm:grid-cols-4 gap-2">
        <input type="hidden" name="item_id" value={item.id} />
        <input type="hidden" name="job_id" value={jobId} />
        <input name="prepared_by" defaultValue={item.prepared_by || ""} placeholder="Prepared by" onBlur={(e) => save("prepared_by", e.target.value)} className={fieldCls} />
        <input name="drawing_number" defaultValue={item.drawing_number || ""} placeholder="Reference number" onBlur={(e) => save("drawing_number", e.target.value)} className={fieldCls} />
        <input name="revision" defaultValue={item.revision || ""} placeholder="Revision" onBlur={(e) => save("revision", e.target.value)} className={fieldCls} />
        <DateField
          name="document_date"
          defaultValue={item.document_date || ""}
          max={today}
          onChange={(e) => {
            if (e.target.value && e.target.value > today) e.target.value = today;
            save("document_date", e.target.value);
          }}
          className={fieldCls}
        />
      </div>
      <div className="text-[11px] h-4 mt-1">{saved && <span className="text-accent font-medium">Saved ✓</span>}</div>
    </form>
  );
}
