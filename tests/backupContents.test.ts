import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { candidatesForJob } from "@/lib/backup/sync";

// What gets copied to the firm's own cloud storage.
//
// The firm's filing holds what it relied on: one file per document, the
// approved one. Superseded drafts and documents still waiting on a
// decision stay in Certlyn. A folder with four plans in it and no way to
// tell which the certificate was issued against is worse than no copy.

const job = {
  id: "job-1",
  pathway: "CDC",
  address: "28 Eucalyptus Street, Constitution Hill",
  pathway_approval_file_path: null,
} as never;

function item(title: string, status: string, files: Record<string, unknown>[]) {
  return { id: title, title, status, file_path: null, checklist_item_files: files };
}

function file(path: string, documentNo: number, isCurrent: boolean, label = "") {
  return { id: path, file_path: path, document_no: documentNo, is_current: isCurrent, label };
}

function paths(candidates: { folder: string; fileName: string }[]) {
  return candidates.map((c) => `${c.folder}/${c.fileName}`);
}

describe("what a backup copies from a checklist", () => {
  test("only the approved version, not the ones it replaced", () => {
    const items = [item("Architectural Plans", "approved", [file("u/plans-v1.pdf", 1, false), file("u/plans-v2.pdf", 1, true)])] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), ["Documents/Document Sets/01 Architectural Plans.pdf"]);
  });

  test("nothing from an item that has not been approved", () => {
    const items = [
      item("Architectural Plans", "approved", [file("u/plans.pdf", 1, true)]),
      item("BASIX Certificate", "submitted", [file("u/basix.pdf", 1, true)]),
      item("Waste Plan", "requested", [file("u/waste.pdf", 1, true)]),
    ] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), ["Documents/Document Sets/01 Architectural Plans.pdf"]);
  });

  // The number is the item's place in Schedule 1, so a document keeps the
  // number the certificate refers to even while the item above it is
  // still outstanding.
  test("numbering follows the checklist, not the approved ones", () => {
    const items = [
      item("Architectural Plans", "submitted", [file("u/plans.pdf", 1, true)]),
      item("BASIX Certificate", "approved", [file("u/basix.pdf", 1, true)]),
    ] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), ["Documents/Document Sets/02 BASIX Certificate.pdf"]);
  });

  test("two documents on one item are told apart by their labels", () => {
    const items = [
      item("Structural Certificates", "approved", [file("u/a.pdf", 1, true, "Slab"), file("u/b.pdf", 2, true, "Frame")]),
    ] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), [
      "Documents/Document Sets/01 Structural Certificates - Slab.pdf",
      "Documents/Document Sets/01 Structural Certificates - Frame.pdf",
    ]);
  });

  test("an unlabelled second document still gets its own name", () => {
    const items = [item("Engineering", "approved", [file("u/a.pdf", 1, true), file("u/b.pdf", 2, true)])] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), [
      "Documents/Document Sets/01 Engineering - Document 1.pdf",
      "Documents/Document Sets/01 Engineering - Document 2.pdf",
    ]);
  });

  test("an approved item with nothing attached copies nothing", () => {
    const items = [item("Approved without a document", "approved", [])] as never[];
    assert.deepEqual(paths(candidatesForJob(job, items, [])), []);
  });

  // Ours, not the client's: an inspection report and its photos are the
  // firm's own record and are copied whatever the checklist says.
  test("inspection reports and photos are still copied", () => {
    const inspections = [
      { id: "i1", title: "Piers", date: "2026-08-26", report_file_path: "r/piers.pdf", inspection_photos: [{ file_path: "p/1.jpg", caption: "" }] },
    ] as never[];
    assert.deepEqual(paths(candidatesForJob(job, [], inspections)), [
      "Documents/Inspections/01 Piers - 26 Aug 2026/Inspection report.pdf",
      "Documents/Inspections/01 Piers - 26 Aug 2026/01.jpg",
    ]);
  });
});
