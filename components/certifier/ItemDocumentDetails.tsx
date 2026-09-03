"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { updateItemDocument, removeItemDocument } from "@/lib/actions/jobs";
import { readDocumentWithAi, type ReadingState } from "@/lib/actions/documentReading";
import { DateField, todayISO } from "@/components/DateField";
import type { ItemDocument } from "@/lib/checklistDocuments";
import type { DocumentReading } from "@/lib/ai/documentReading";

// Which box each suggestion belongs in, in the order the boxes sit.
const SUGGESTED_FIELDS: { name: string; label: string; pick: (r: DocumentReading) => string | null }[] = [
  { name: "label", label: "Label", pick: (r) => r.label },
  { name: "prepared_by", label: "Prepared by", pick: (r) => r.preparedBy },
  { name: "drawing_number", label: "Reference number", pick: (r) => r.referenceNumber },
  { name: "revision", label: "Revision", pick: (r) => r.revision },
  { name: "document_date", label: "Date", pick: (r) => r.documentDate },
];

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
export function ItemDocumentDetails({
  doc,
  itemId,
  itemTitle,
  jobId,
  removable,
  aiConfigured = false,
}: {
  doc: ItemDocument;
  itemId: string;
  itemTitle?: string;
  jobId: string;
  removable: boolean;
  // Whether the deployment has an AI key. Without one the Read button
  // is not offered at all, rather than offered and then refused.
  aiConfigured?: boolean;
}) {
  const today = todayISO();
  const [, startTransition] = useTransition();
  const [readState, read, reading] = useActionState<ReadingState, FormData>(readDocumentWithAi, undefined);
  // The AI reads a stored file; the stand-in "item" document has none.
  const canRead = aiConfigured && doc.id !== "item" && !!doc.filePath;
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // A blank label starts as the item's own title — that's what Schedule 1
  // will call the document anyway, so the box shows the truth and the
  // certifier amends it only when it should read differently.
  const defaultLabel = doc.label || itemTitle || "";
  const lastSent = useRef<Record<string, string>>({
    label: defaultLabel,
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
    // Confirmed on the spot; the write itself finishes in the
    // background. Waiting for the server before saying Saved made five
    // quick fields feel like wading.
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
    startTransition(async () => {
      await updateItemDocument(fd);
    });
  }

  // The suggestion goes into the box and saves the way a typed value
  // does — so what was applied is what is on the record, with no second
  // path to the database.
  function apply(name: string, value: string) {
    const el = formRef.current?.elements.namedItem(name);
    if (el instanceof HTMLInputElement) el.value = value;
    save(name, value);
  }

  function readWithAi() {
    const fd = new FormData();
    fd.set("file_id", doc.id);
    fd.set("job_id", jobId);
    startTransition(() => read(fd));
  }

  function currentValue(name: string): string {
    const el = formRef.current?.elements.namedItem(name);
    return el instanceof HTMLInputElement ? el.value : "";
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
      <input name="label" defaultValue={defaultLabel} placeholder="Label (e.g. Ground floor)" onBlur={(e) => save("label", e.target.value)} className={fieldCls} />
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
        {saved && <span className="text-accent font-medium">Saved ✓</span>}
        {canRead && (
          <button
            type="button"
            onClick={readWithAi}
            disabled={reading}
            title="Sends the first pages of this document to the AI, which reads the title block and suggests these details. Nothing is saved until you press Use."
            className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline disabled:opacity-60"
          >
            <Sparkles size={11} /> {reading ? "Reading…" : readState?.reading ? "Read again with AI" : "Read the details with AI"}
          </button>
        )}
        {removable && (
          <button type="button" onClick={remove} className="ml-auto text-error hover:underline">
            Remove this document
          </button>
        )}
      </div>

      {readState?.error && <p className="sm:col-span-5 text-[11px] text-error">{readState.error}</p>}

      {readState?.reading && (
        <ReadingSuggestions reading={readState.reading} pagesRead={readState.pagesRead} totalPages={readState.totalPages} currentValue={currentValue} apply={apply} />
      )}
    </form>
  );
}

// What the AI read, beside what the boxes hold now, each with its own
// Use button and one for the lot. A suggestion that matches what is
// already there is shown as agreeing rather than offered again.
function ReadingSuggestions({
  reading,
  pagesRead,
  totalPages,
  currentValue,
  apply,
}: {
  reading: DocumentReading;
  pagesRead?: number;
  totalPages?: number;
  currentValue: (name: string) => string;
  apply: (name: string, value: string) => void;
}) {
  const rows = SUGGESTED_FIELDS.map((f) => ({ ...f, value: f.pick(reading) })).filter((f) => f.value);
  const differing = rows.filter((f) => f.value !== currentValue(f.name));

  return (
    <div className="sm:col-span-5 rounded-md border border-info-bg bg-info-bg/40 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-heading inline-flex items-center gap-1">
          <Sparkles size={12} className="text-icon" /> What the AI read{reading.documentType ? ` — ${reading.documentType}` : ""}
        </span>
        {differing.length > 0 && (
          <button
            type="button"
            onClick={() => differing.forEach((f) => apply(f.name, f.value!))}
            className="px-2.5 py-1 rounded bg-primary text-white text-[11px] font-semibold hover:bg-primary-700"
          >
            Use all {differing.length}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">Nothing usable could be read off this document.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((f) => {
            const same = f.value === currentValue(f.name);
            return (
              <li key={f.name} className="flex items-center gap-2 flex-wrap">
                <span className="text-placeholder w-28 shrink-0">{f.label}</span>
                <span className="text-heading">{f.name === "document_date" ? formatDay(f.value!) : f.value}</span>
                {same ? (
                  <span className="text-[11px] text-accent">✓ already</span>
                ) : (
                  <button type="button" onClick={() => apply(f.name, f.value!)} className="text-[11px] font-semibold text-secondary hover:underline">
                    Use
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reading.addressMatches === "no" && (
        <p className="text-warning-text font-medium">
          The address on this document reads &ldquo;{reading.addressOnDocument || "something else"}&rdquo; — check it belongs to this project.
        </p>
      )}
      {reading.addressMatches === "yes" && <p className="text-accent">The address on the document matches this project.</p>}
      {reading.addressMatches === "unknown" && <p className="text-placeholder">No site address could be found on the document.</p>}
      {reading.notes.length > 0 && (
        <ul className="list-disc pl-4 text-warning-text space-y-0.5">
          {reading.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {pagesRead && totalPages && totalPages > pagesRead && (
        <p className="text-placeholder">Only the first {pagesRead} of {totalPages} pages were read.</p>
      )}
      <p className="text-placeholder">Suggestions only — check them against the document before relying on them.</p>
    </div>
  );
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
