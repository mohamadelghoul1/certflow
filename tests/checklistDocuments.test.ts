import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { currentDocuments, versionsOf, documentTitle, scheduleRows } from "@/lib/checklistDocuments";
import type { ChecklistItemFile } from "@/types/db";

function file(over: Partial<ChecklistItemFile> & { file_path: string; version: number }): ChecklistItemFile {
  return { id: over.file_path, checklist_item_id: "i1", uploaded_by_role: "client", uploaded_by: null, created_at: "2026-08-01T00:00:00Z", ...over } as ChecklistItemFile;
}

const item = {
  file_path: "p/v4.pdf",
  prepared_by: "Acme Engineers",
  drawing_number: "SE-01",
  revision: "B",
  document_date: "2026-07-01",
};

describe("the documents on a checklist item", () => {
  test("lists every current document, in document order", () => {
    const docs = currentDocuments({
      ...item,
      checklist_item_files: [
        file({ file_path: "p/cert2-v2.pdf", version: 2, document_no: 2, is_current: true, prepared_by: "Beta Consulting", drawing_number: "BC-77" }),
        file({ file_path: "p/v4.pdf", version: 4, document_no: 1, is_current: true }),
        file({ file_path: "p/v3.pdf", version: 3, document_no: 1, is_current: false }),
      ],
    });
    assert.deepEqual(
      docs.map((d) => [d.documentNo, d.filePath]),
      [
        [1, "p/v4.pdf"],
        [2, "p/cert2-v2.pdf"],
      ]
    );
  });

  test("a document keeps its own details, and borrows the item's where it has none", () => {
    const [first, second] = currentDocuments({
      ...item,
      checklist_item_files: [
        file({ file_path: "a.pdf", version: 1, document_no: 1, is_current: true }),
        file({ file_path: "b.pdf", version: 1, document_no: 2, is_current: true, prepared_by: "Beta Consulting", drawing_number: "BC-77", revision: "A", document_date: "2026-08-10" }),
      ],
    });
    assert.equal(first.preparedBy, "Acme Engineers", "the first document falls back to the item's details");
    assert.equal(second.preparedBy, "Beta Consulting");
    assert.equal(second.drawingNumber, "BC-77");
    assert.equal(second.documentDate, "2026-08-10");
  });

  // A database where migration 0023 hasn't been run has rows with no
  // document_no or is_current at all. An approval generated there must
  // still contain the documents.
  test("falls back to the item's own file when no row is marked current", () => {
    const docs = currentDocuments({
      ...item,
      checklist_item_files: [file({ file_path: "p/v3.pdf", version: 3 }), file({ file_path: "p/v4.pdf", version: 4 })],
    });
    assert.deepEqual(docs.map((d) => d.filePath), ["p/v4.pdf"]);
    assert.equal(docs[0].preparedBy, "Acme Engineers");
  });

  test("an item with nothing uploaded contributes nothing", () => {
    assert.deepEqual(currentDocuments({ file_path: null, checklist_item_files: [] }), []);
  });

  test("keeps each document's own version history", () => {
    const withHistory = {
      ...item,
      checklist_item_files: [
        file({ file_path: "p/v1.pdf", version: 1, document_no: 1, is_current: false }),
        file({ file_path: "p/v4.pdf", version: 4, document_no: 1, is_current: true }),
        file({ file_path: "p/cert2.pdf", version: 1, document_no: 2, is_current: true }),
      ],
    };
    assert.deepEqual(versionsOf(withHistory, 1).map((f) => f.version), [4, 1]);
    assert.deepEqual(versionsOf(withHistory, 2).map((f) => f.version), [1]);
  });
});

describe("how a document is titled on Schedule 1", () => {
  const doc = { id: "1", documentNo: 2, filePath: "b.pdf", label: "", preparedBy: null, drawingNumber: null, revision: null, documentDate: null };

  test("a lone document is just the item's title", () => {
    assert.equal(documentTitle("Structural Certificate", doc, 1), "Structural Certificate");
  });

  test("several are numbered, so two certificates aren't the same row twice", () => {
    assert.equal(documentTitle("Structural Certificate", doc, 2), "Structural Certificate (2 of 2)");
  });

  test("a labelled document uses its label", () => {
    assert.equal(documentTitle("Structural Certificate", { ...doc, label: "Ground floor" }, 2), "Structural Certificate — Ground floor");
  });
});

describe("Schedule 1", () => {
  const plans = { id: "plans", title: "Architectural Plans", status: "approved", file_path: "plans.pdf", prepared_by: "Studio North", drawing_number: "A-01", revision: "C", document_date: "2026-06-01" };

  test("an item satisfied by two certificates becomes two rows, each with its own details", () => {
    const rows = scheduleRows([
      plans,
      {
        id: "struct",
        title: "Structural Certificate",
        status: "approved",
        file_path: "one.pdf",
        prepared_by: "Acme Engineers",
        drawing_number: "SE-01",
        revision: "B",
        document_date: "2026-07-01",
        checklist_item_files: [
          file({ file_path: "one.pdf", version: 1, document_no: 1, is_current: true }),
          file({ file_path: "two.pdf", version: 1, document_no: 2, is_current: true, prepared_by: "Beta Consulting", drawing_number: "BC-77", revision: "A", document_date: "2026-08-10" }),
        ],
      },
    ]);

    assert.equal(rows.length, 3, "one row for the plans, two for the certificates");
    assert.deepEqual(
      rows.map((r) => [r.title, r.prepared_by, r.drawing_number, r.document_date]),
      [
        ["Architectural Plans", "Studio North", "A-01", "2026-06-01"],
        ["Structural Certificate (1 of 2)", "Acme Engineers", "SE-01", "2026-07-01"],
        ["Structural Certificate (2 of 2)", "Beta Consulting", "BC-77", "2026-08-10"],
      ]
    );
  });

  test("rows have distinct ids, so React doesn't collapse two documents into one", () => {
    const rows = scheduleRows([
      {
        id: "struct",
        title: "Structural Certificate",
        status: "approved",
        file_path: "one.pdf",
        checklist_item_files: [
          file({ file_path: "one.pdf", version: 1, document_no: 1, is_current: true }),
          file({ file_path: "two.pdf", version: 1, document_no: 2, is_current: true }),
        ],
      },
    ]);
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  });

  test("an item awaiting its document still appears", () => {
    const rows = scheduleRows([{ id: "basix", title: "BASIX Certificate", status: "requested", file_path: null, checklist_item_files: [] }]);
    assert.deepEqual(rows.map((r) => r.title), ["BASIX Certificate"]);
  });

  // A database where migration 0023 hasn't been run must still produce a
  // Schedule listing every item exactly once.
  test("one row per item before the migration has been run", () => {
    const rows = scheduleRows([
      { ...plans, checklist_item_files: [file({ file_path: "plans-v1.pdf", version: 1 }), file({ file_path: "plans.pdf", version: 2 })] },
    ]);
    assert.deepEqual(rows.map((r) => [r.title, r.prepared_by]), [["Architectural Plans", "Studio North"]]);
  });
});
