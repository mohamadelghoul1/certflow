"use client";

import { useRef, useState, useTransition } from "react";
import { updateItemDocument, removeItemDocument } from "@/lib/actions/jobs";
import { DateField, todayISO } from "@/components/DateField";
import type { ItemDocument } from "@/lib/checklistDocuments";

const fieldCls = "px-2 py-1.5 rounded border border-line text-xs";

// Prepared by / reference / revision / date for one document on an item,
// plus the label that tells two of them apart on Schedule 1.
//
// Per document rather than per item because two certificates under one
// item rarely share a preparer, a reference or a date, and a Schedule
// that lists them under a single row is inaccurate.
//
// Saves itself when a field loses focus, like the item's own details do —
// a Save button is one press too many for five small boxes filled in one
// after the other.
export function ItemDocumentDetails({ doc, itemId, jobId, removable }: { doc: ItemDocument; itemId: string; jobId: string; removable: boolean }) {
  const today = todayISO();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSent = useRef<Record<string, string>>({
    label: doc.label || "",
    prepared_by: doc.preparedBy || "",
    drawing_number: doc.drawingNumber || "",
    revision: doc.revision || "",
    document_date: doc.documentDate || "",
  });
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(name: string, value: string) {
    if (lastSent.current[name] === value) return;
    lastSent.current[name] = value;
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    startTransition(async () => {
      await updateItemDocument(fd);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    });
  }

  function remove() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("document_no", String(doc.documentNo));
      await removeItemDocument(fd);
    });
  }

  return (
    <form ref={formRef} className="grid sm:grid-cols-5 gap-2">
      <input type="hidden" name="file_id" value={doc.id} />
      <input type="hidden" name="job_id" value={jobId} />
      <input name="label" defaultValue={doc.label} placeholder="Label (e.g. Ground floor)" onBlur={(e) => save("label", e.target.value)} className={fieldCls} />
      <input name="prepared_by" defaultValue={doc.preparedBy || ""} placeholder="Prepared by" onBlur={(e) => save("prepared_by", e.target.value)} className={fieldCls} />
      <input name="drawing_number" defaultValue={doc.drawingNumber || ""} placeholder="Reference number" onBlur={(e) => save("drawing_number", e.target.value)} className={fieldCls} />
      <input name="revision" defaultValue={doc.revision || ""} placeholder="Revision" onBlur={(e) => save("revision", e.target.value)} className={fieldCls} />
      {/* A date picker commits on selection rather than on the way out, so
          it saves on change instead of blur, and a document can't be dated
          in the future. */}
      <DateField
        name="document_date"
        defaultValue={doc.documentDate || ""}
        max={today}
        onChange={(e) => {
          if (e.target.value && e.target.value > today) e.target.value = today;
          save("document_date", e.target.value);
        }}
        className={fieldCls}
      />
      <div className="sm:col-span-5 flex items-center gap-3 text-[11px] h-4">
        {pending && <span className="text-muted">Saving…</span>}
        {!pending && saved && <span className="text-accent font-medium">Saved ✓</span>}
        {removable && (
          <button type="button" onClick={remove} className="ml-auto text-error hover:underline">
            Remove this document
          </button>
        )}
      </div>
    </form>
  );
}
