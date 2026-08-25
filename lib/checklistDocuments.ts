import type { ChecklistItemFile } from "@/types/db";

// The documents currently attached to a checklist item.
//
// An item used to hold exactly one file. Migration 0023 lets it hold
// several — two structural certificates for one certification, a report
// and its addendum — each with its own Schedule 1 details and its own
// version history behind it.
//
// Everything that assembles an approval reads the item through here, so
// there is one answer to "which files does this item contribute" rather
// than each of Schedule 1, the approved set and the screen working it out
// again.

export type ItemDocument = {
  // The row id, or "item" for the fallback below.
  id: string;
  documentNo: number;
  filePath: string | null;
  label: string;
  preparedBy: string | null;
  drawingNumber: string | null;
  revision: string | null;
  documentDate: string | null;
};

type ItemLike = {
  file_path?: string | null;
  prepared_by?: string | null;
  drawing_number?: string | null;
  revision?: string | null;
  document_date?: string | null;
  checklist_item_files?: ChecklistItemFile[] | null;
};

// The item's own file and details, as the single document it has always
// been. Used for an item uploaded before migration 0021 recorded files
// individually, and for any database where 0023 has not been run — where
// the rows exist but carry no document_no or is_current at all. Without
// it, an approval generated on such a database would come out with no
// documents in it, which is far worse than one that ignores the new
// column.
function fallbackDocument(item: ItemLike): ItemDocument[] {
  if (!item.file_path) return [];
  return [
    {
      id: "item",
      documentNo: 1,
      filePath: item.file_path,
      label: "",
      preparedBy: item.prepared_by ?? null,
      drawingNumber: item.drawing_number ?? null,
      revision: item.revision ?? null,
      documentDate: item.document_date ?? null,
    },
  ];
}

export function currentDocuments(item: ItemLike): ItemDocument[] {
  const files = item.checklist_item_files || [];
  const current = files.filter((f) => f.is_current === true && f.file_path);
  if (current.length === 0) return fallbackDocument(item);

  return [...current]
    .sort((a, b) => (a.document_no ?? 1) - (b.document_no ?? 1))
    .map((f) => ({
      id: f.id,
      documentNo: f.document_no ?? 1,
      filePath: f.file_path,
      label: f.label || "",
      // A document that carries no details of its own falls back to the
      // item's, which is where they lived before 0023 and where a single
      // document's details are still entered.
      preparedBy: f.prepared_by ?? item.prepared_by ?? null,
      drawingNumber: f.drawing_number ?? item.drawing_number ?? null,
      revision: f.revision ?? item.revision ?? null,
      documentDate: f.document_date ?? item.document_date ?? null,
    }));
}

// Every version of one document on an item, newest first.
export function versionsOf(item: ItemLike, documentNo: number): ChecklistItemFile[] {
  return (item.checklist_item_files || []).filter((f) => (f.document_no ?? 1) === documentNo).sort((a, b) => b.version - a.version);
}

// How a document is titled on Schedule 1: the item's title, with the
// document's own label after it when there is more than one, so two
// certificates under one item are told apart rather than appearing as the
// same row twice.
export function documentTitle(itemTitle: string, doc: ItemDocument, total: number) {
  if (total < 2) return itemTitle;
  return doc.label ? `${itemTitle} — ${doc.label}` : `${itemTitle} (${doc.documentNo} of ${total})`;
}

export type ScheduleRow = {
  id: string;
  title: string;
  status: string;
  document_date: string | null;
  prepared_by: string | null;
  drawing_number: string | null;
  revision: string | null;
};

type ScheduleItem = ItemLike & { id: string; title: string; status: string };

// Schedule 1, one row per document rather than per checklist item. An
// item holding two certificates is two rows, each with its own preparer,
// reference and date — a Schedule that listed them under one row would
// name only one certificate's details and be wrong about the other.
//
// An item with nothing uploaded still gets its row: Schedule 1 lists what
// the certificate relies on, whether or not the file has arrived.
export function scheduleRows(items: ScheduleItem[]): ScheduleRow[] {
  return items.flatMap((item) => {
    const docs = currentDocuments(item);
    if (docs.length === 0) {
      return [
        {
          id: item.id,
          title: item.title,
          status: item.status,
          document_date: item.document_date ?? null,
          prepared_by: item.prepared_by ?? null,
          drawing_number: item.drawing_number ?? null,
          revision: item.revision ?? null,
        },
      ];
    }
    return docs.map((doc) => ({
      id: `${item.id}:${doc.documentNo}`,
      title: documentTitle(item.title, doc, docs.length),
      status: item.status,
      document_date: doc.documentDate,
      prepared_by: doc.preparedBy,
      drawing_number: doc.drawingNumber,
      revision: doc.revision,
    }));
  });
}
