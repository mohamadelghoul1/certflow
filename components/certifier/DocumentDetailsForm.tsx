"use client";

import { useRef, useState, useTransition } from "react";
import { updateItemMeta } from "@/lib/actions/jobs";
import { DateField, todayISO } from "@/components/DateField";
import type { ChecklistItem } from "@/types/db";

const fieldCls = "px-2 py-1.5 rounded border border-line text-xs";

// Prepared by / reference number / revision / date for one checklist
// item — the four columns that end up in the DOCUMENTS REQUESTED table on
// the certificate.
//
// Saves itself. There was a "Save details" button under these, which is
// one press too many for four small boxes that are usually filled in one
// after the other: leaving the field is a clear enough signal that you're
// done with it. Each field saves when it loses focus, and only if its
// value actually changed, so tabbing straight through costs nothing.
export function DocumentDetailsForm({ item, jobId }: { item: ChecklistItem; jobId: string }) {
  const today = todayISO();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // The values last sent, so an unchanged field doesn't trigger a save.
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

    startTransition(async () => {
      await updateItemMeta(fd);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form ref={formRef} className="mt-2 grid sm:grid-cols-4 gap-2">
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="job_id" value={jobId} />
      <input
        name="prepared_by"
        defaultValue={item.prepared_by || ""}
        placeholder="Prepared by"
        onBlur={(e) => save("prepared_by", e.target.value)}
        className={fieldCls}
      />
      <input
        name="drawing_number"
        defaultValue={item.drawing_number || ""}
        placeholder="Reference number"
        onBlur={(e) => save("drawing_number", e.target.value)}
        className={fieldCls}
      />
      <input name="revision" defaultValue={item.revision || ""} placeholder="Revision" onBlur={(e) => save("revision", e.target.value)} className={fieldCls} />
      {/* A date picker commits on selection rather than on the way out, so
          it saves on change instead of blur. A document can't be dated in
          the future, so today is the latest it will accept — `max` greys
          out later days in the calendar, and the check below catches a
          date typed straight into the box, which `max` alone doesn't. */}
      <DateField
        name="document_date"
        defaultValue={item.document_date || ""}
        max={today}
        onChange={(e) => {
          if (e.target.value && e.target.value > today) {
            e.target.value = today;
          }
          save("document_date", e.target.value);
        }}
        className={fieldCls}
      />
      <div className="sm:col-span-4 text-[11px] h-4">
        {pending && <span className="text-muted">Saving…</span>}
        {!pending && saved && <span className="text-accent font-medium">Saved ✓</span>}
      </div>
    </form>
  );
}
