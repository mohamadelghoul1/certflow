import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { documentEntries, buildChecklistZip, chosenEntries, documentKey, type NamedItem } from "@/lib/archive/checklistDocuments";

// Everything on one checklist, in one zip, named the way the checklist
// names it — so a certifier is not left with a Downloads folder full of
// "scan_0001.pdf".

let nextId = 0;

function item(title: string, files: { path: string; no?: number; label?: string; current?: boolean }[]): NamedItem {
  return {
    id: `item-${++nextId}`,
    title,
    checklist_item_files: files.map((f, i) => ({
      id: `f${i}`,
      checklist_item_id: "i",
      file_path: f.path,
      version: 1,
      uploaded_by_role: "client",
      uploaded_by: null,
      created_at: "2026-09-01",
      document_no: f.no ?? 1,
      is_current: f.current ?? true,
      label: f.label ?? null,
    })) as never,
  } as NamedItem;
}

const names = (items: NamedItem[]) => documentEntries(items).map((e) => e.fileName);

describe("what goes into the zip", () => {
  test("each document is numbered by its place on the checklist and named after the item", () => {
    const items = [item("Architectural Plans", [{ path: "u/a.pdf" }]), item("BASIX Certificate", [{ path: "u/b.pdf" }])];
    assert.deepEqual(names(items), ["01 Architectural Plans.pdf", "02 BASIX Certificate.pdf"]);
  });

  test("an item with two documents gets one file each, told apart by their labels", () => {
    const items = [
      item("Engineering", [
        { path: "u/a.pdf", no: 1, label: "Slab" },
        { path: "u/b.pdf", no: 2, label: "Frame" },
      ]),
    ];
    assert.deepEqual(names(items), ["01 Engineering - Slab.pdf", "01 Engineering - Frame.pdf"]);
  });

  test("superseded versions stay out — the download is the checklist as it stands", () => {
    const items = [item("Plans", [{ path: "u/old.pdf", current: false }, { path: "u/new.pdf", current: true }])];
    assert.deepEqual(names(items), ["01 Plans.pdf"]);
    assert.deepEqual(documentEntries(items)[0].storagePath, "u/new.pdf");
  });

  test("a row with nothing uploaded contributes nothing", () => {
    assert.deepEqual(names([item("Waiting on the client", [])]), []);
  });

  test("two items with the same name do not become one file", () => {
    const items = [item("Survey", [{ path: "u/a.pdf" }]), item("Survey", [{ path: "u/b.pdf" }])];
    // Numbered by position, so they differ anyway — but the guard holds
    // even when the numbering cannot save them.
    assert.equal(new Set(names(items)).size, 2);
    const same = [item("Survey", [{ path: "u/a.pdf" }, { path: "u/b.pdf", no: 1 }])];
    assert.equal(new Set(names(same)).size, names(same).length, "no file may be silently replaced by another");
  });

  test("a name a certifier typed with a slash in it does not become a folder", () => {
    assert.deepEqual(names([item("Plans / Elevations", [{ path: "u/a.pdf" }])]), ["01 Plans - Elevations.pdf"]);
  });
});

describe("building it", () => {
  const entries = [
    { key: "a:1", fileName: "01 Plans.pdf", storagePath: "u/a.pdf", itemTitle: "Plans" },
    { key: "b:1", fileName: "02 BASIX.pdf", storagePath: "u/b.pdf", itemTitle: "BASIX" },
  ];

  test("holds every file that could be read", async () => {
    const zip = await buildChecklistZip(entries, async () => new Uint8Array([1, 2, 3]));
    assert.equal(zip.included, 2);
    assert.deepEqual(zip.missing, []);
    assert.ok(zip.bytes.length > 0);
  });

  test("one unreadable file does not cost the certifier the others", async () => {
    const zip = await buildChecklistZip(entries, async (path) => (path === "u/a.pdf" ? new Uint8Array([1]) : null));
    assert.equal(zip.included, 1, "the readable one is still there");
    assert.deepEqual(zip.missing, ["02 BASIX.pdf"]);
  });
});


// Ticking a few of twenty, rather than taking the lot.
describe("choosing which documents to download", () => {
  const items = [item("Plans", [{ path: "u/a.pdf" }]), item("BASIX", [{ path: "u/b.pdf" }]), item("Survey", [{ path: "u/c.pdf" }])];
  const all = documentEntries(items);

  test("no choice at all means everything — the plain button", () => {
    assert.equal(chosenEntries(all, null).length, 3);
    assert.equal(chosenEntries(all, []).length, 3, "an empty list is not a request for nothing");
  });

  test("only the ticked ones are included", () => {
    const picked = chosenEntries(all, [all[0].key, all[2].key]);
    assert.deepEqual(picked.map((e) => e.storagePath), ["u/a.pdf", "u/c.pdf"]);
  });

  test("the numbering stays that of the whole checklist, so a file can still be matched to its row", () => {
    const picked = chosenEntries(all, [all[2].key]);
    assert.deepEqual(picked.map((e) => e.fileName), ["03 Survey.pdf"], "not renumbered to 01");
  });

  test("a key naming nothing on this checklist matches nothing", () => {
    assert.deepEqual(chosenEntries(all, ["some-other-job-item:1"]), []);
  });

  test("every document has a key of its own, including two on the same item", () => {
    const twoDocs = [item("Engineering", [{ path: "u/a.pdf", no: 1 }, { path: "u/b.pdf", no: 2 }])];
    const entries = documentEntries(twoDocs);
    assert.equal(new Set(entries.map((e) => e.key)).size, 2);
    assert.equal(entries[0].key, documentKey(twoDocs[0].id, 1));
  });

  // A document uploaded before migration 0023 reports its id as "item",
  // so keying on that alone would give every one of them the same key
  // and ticking one would tick them all.
  test("documents from before per-document rows still get distinct keys", () => {
    const legacy = [
      { id: "old-1", title: "Plans", file_path: "u/old-a.pdf" } as NamedItem,
      { id: "old-2", title: "Survey", file_path: "u/old-b.pdf" } as NamedItem,
    ];
    const entries = documentEntries(legacy);
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((e) => e.key)).size, 2);
    assert.deepEqual(chosenEntries(entries, [entries[1].key]).map((e) => e.storagePath), ["u/old-b.pdf"]);
  });
});
