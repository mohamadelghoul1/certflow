import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFileName, jobDocumentName, attachmentHeader } from "@/lib/downloadName";

// A certificate reference carries a slash, which every browser rewrites
// before saving — the defect that produced "CDC-26001_01-Approved-Set".
test("a reference's slash never reaches the browser", () => {
  assert.equal(safeFileName("CDC-26001/01"), "CDC-26001-01");
  assert.ok(!jobDocumentName("CDC-26001/01", "21 Coquet Way", "Approved Set", "pdf").includes("/"));
});

test("a document is filed under reference, address and what it is", () => {
  assert.equal(
    jobDocumentName("CDC-26001/01", "21 Coquet Way, Green Valley", "Approved Set", "pdf"),
    "CDC-26001-01 - 21 Coquet Way, Green Valley - Approved Set.pdf"
  );
});

// A certifier who renamed the reference to include the address should not
// be handed it twice.
test("an address already in the reference is not repeated", () => {
  assert.equal(
    jobDocumentName("CDC-26001 - 21 Coquet Way, Green Valley", "21 Coquet Way, Green Valley", "Approved Set", "pdf"),
    "CDC-26001 - 21 Coquet Way, Green Valley - Approved Set.pdf"
  );
});

test("the address match ignores case and punctuation", () => {
  const name = jobDocumentName("CDC-26001 - 21 COQUET WAY GREEN VALLEY", "21 Coquet Way, Green Valley", "Approved Set", "pdf");
  assert.equal(name, "CDC-26001 - 21 COQUET WAY GREEN VALLEY - Approved Set.pdf");
});

test("characters a filesystem rejects are dropped, spaces and commas kept", () => {
  assert.equal(safeFileName('CDC-26001/01 <draft>: "v2"'), "CDC-26001-01 draft v2");
});

// Sent twice so a client that reads only the ASCII form still gets a
// sensible name, and one that reads filename* gets the real characters.
test("the attachment header carries an ASCII name and a UTF-8 name", () => {
  const header = attachmentHeader("CDC-26001 – 21 Coquet Way.pdf");
  assert.match(header, /^attachment; filename="[^"]+"; filename\*=UTF-8''/);
  assert.ok(!/[^\x00-\x7f]/.test(header.split(";")[1]), "the plain filename must be ASCII only");
  assert.ok(header.includes(encodeURIComponent("–")), "filename* keeps the real character");
});
